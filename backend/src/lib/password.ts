import argon2 from 'argon2';

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export const hashPassword = (plain: string) => argon2.hash(plain, ARGON_OPTIONS);
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);
