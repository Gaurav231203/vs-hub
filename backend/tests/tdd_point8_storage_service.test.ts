import { prisma } from '../src/lib/prisma.js';
import { StorageService } from '../src/lib/storage.js';
import { LibraryService } from '../src/modules/library/library.service.js';

async function runTest() {
  console.log('--- [TDD TEST POINT 8] Cloudflare R2 / S3 Storage & Security Hardening ---');

  const workspace = await prisma.workspace.findFirstOrThrow();
  const brand = await prisma.brand.findFirstOrThrow({ where: { workspaceId: workspace.id } });
  const author = await prisma.user.findFirstOrThrow();

  const ctx: any = {
    userId: author.id,
    workspaceId: workspace.id,
    role: 'OWNER',
    brandIds: [brand.id],
    allBrands: true,
    perms: ['assets.create', 'assets.view', 'assets.delete'],
  };

  // 1. Valid Presigned URL Generation
  console.log('1. Testing valid presigned URL generation...');
  const uploadInfo = await StorageService.generatePresignedUploadUrl({
    workspaceId: workspace.id,
    brandId: brand.id,
    filename: 'summer_bakery_cake.png',
    contentType: 'image/png',
    byteSize: 1024 * 1024 * 2, // 2 MB
  });

  if (!uploadInfo.uploadUrl || !uploadInfo.publicUrl || !uploadInfo.key) {
    throw new Error('FAIL: StorageService failed to return uploadUrl, publicUrl, and key!');
  }
  if (!uploadInfo.key.startsWith(`media/${workspace.id}/${brand.id}/`)) {
    throw new Error(`FAIL: Storage key path incorrect: ${uploadInfo.key}`);
  }
  console.log('✅ Generated presigned upload URL and public CDN URL cleanly.');

  // 2. Adversarial Test: Path Traversal in Filename
  console.log('2. Testing Path Traversal attack in filename...');
  const pathTraversalUpload = await StorageService.generatePresignedUploadUrl({
    workspaceId: workspace.id,
    brandId: brand.id,
    filename: '../../../../windows/system32/cmd.exe.png',
    contentType: 'image/png',
    byteSize: 1024,
  });

  if (pathTraversalUpload.key.includes('..') || pathTraversalUpload.key.includes('/windows/')) {
    throw new Error(`CRITICAL SECURITY FAILURE: Path traversal was NOT neutralized! Key: ${pathTraversalUpload.key}`);
  }
  console.log('✅ Path traversal neutralized. Key:', pathTraversalUpload.key);

  // 3. Adversarial Test: Malicious SVG / HTML / Executable Ingestion
  console.log('3. Testing SVG/HTML/Script MIME attack rejection...');
  const maliciousTypes = [
    { filename: 'xss.svg', contentType: 'image/svg+xml' },
    { filename: 'phishing.html', contentType: 'text/html' },
    { filename: 'trojan.exe', contentType: 'application/x-msdownload' },
    { filename: 'fake_jpg.jpg', contentType: 'text/html' }, // MIME mismatch
  ];

  for (const m of maliciousTypes) {
    let rejected = false;
    try {
      await StorageService.generatePresignedUploadUrl({
        workspaceId: workspace.id,
        brandId: brand.id,
        filename: m.filename,
        contentType: m.contentType,
        byteSize: 1024,
      });
    } catch {
      rejected = true;
    }

    if (!rejected) {
      throw new Error(`CRITICAL SECURITY FAILURE: System accepted dangerous payload: ${m.filename} (${m.contentType})!`);
    }
  }
  console.log('✅ All dangerous SVG, HTML, and executable MIME types cleanly rejected.');

  // 4. Adversarial Test: Oversized File Quota Violation
  console.log('4. Testing file size quota violation (60MB image)...');
  let rejectedOversized = false;
  try {
    await StorageService.generatePresignedUploadUrl({
      workspaceId: workspace.id,
      brandId: brand.id,
      filename: 'giant_poster.png',
      contentType: 'image/png',
      byteSize: 1024 * 1024 * 60, // 60 MB (exceeds 50MB limit)
    });
  } catch {
    rejectedOversized = true;
  }
  if (!rejectedOversized) {
    throw new Error('FAIL: System accepted oversized 60MB image exceeding 50MB quota!');
  }
  console.log('✅ Oversized file rejected.');

  // 5. Confirm Upload Integration: Ingesting Asset into MediaAsset DB
  console.log('5. Testing confirmUpload and database asset creation...');
  const asset = await LibraryService.confirmUpload(ctx, {
    brandId: brand.id,
    title: 'Summer Bakery Pastry',
    kind: 'IMAGE',
    publicUrl: uploadInfo.publicUrl,
    key: uploadInfo.key,
    byteSize: 1024 * 1024 * 2,
    contentType: 'image/png',
    width: 1200,
    height: 800,
  });

  const dbAsset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
  if (dbAsset.url !== uploadInfo.publicUrl || dbAsset.bytes !== 1024 * 1024 * 2) {
    throw new Error('FAIL: MediaAsset not properly persisted in database!');
  }
  console.log('✅ Asset confirmed and saved in MediaAsset table ID:', asset.id);

  // 6. Cross-Tenant Protection on Confirm Upload
  console.log('6. Testing Cross-Tenant Confirm Upload IDOR...');
  const rogueWs = await prisma.workspace.create({ data: { name: 'Rogue Storage Tenant', timezone: 'UTC' } });
  const rogueBrand = await prisma.brand.create({ data: { workspaceId: rogueWs.id, name: 'Rogue Storage Brand' } });

  let crossTenantRejected = false;
  try {
    await LibraryService.confirmUpload(ctx, {
      brandId: rogueBrand.id, // Does not belong to ctx.workspaceId!
      title: 'Stolen Brand Asset',
      kind: 'IMAGE',
      publicUrl: 'https://cdn.example.com/stolen.jpg',
      key: 'media/stolen.jpg',
      byteSize: 1024,
      contentType: 'image/jpeg',
    });
  } catch {
    crossTenantRejected = true;
  } finally {
    await prisma.brand.delete({ where: { id: rogueBrand.id } });
    await prisma.workspace.delete({ where: { id: rogueWs.id } });
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  }

  if (!crossTenantRejected) {
    throw new Error('CRITICAL SECURITY FAILURE: Cross-tenant confirmUpload was allowed!');
  }
  console.log('✅ Cross-tenant asset confirmation blocked.');

  console.log('✅ TDD TEST POINT 8 PASSED: Cloudflare R2 / S3 Presigned URL Media Storage verified.');
}

runTest().catch((err) => {
  console.error('❌ TDD TEST POINT 8 FAILED:', err.message);
  process.exit(1);
});
