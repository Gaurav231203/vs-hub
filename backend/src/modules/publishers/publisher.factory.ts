import { Publisher } from './publisher.interface.js';
import { FacebookPublisher } from './facebook.publisher.js';
import { InstagramPublisher } from './instagram.publisher.js';
import { ThreadsPublisher } from './threads.publisher.js';
import { LinkedInPublisher } from './linkedin.publisher.js';
import { YouTubePublisher } from './youtube.publisher.js';
import { XPublisher } from './x.publisher.js';
import { TikTokPublisher } from './tiktok.publisher.js';
import { PinterestPublisher } from './pinterest.publisher.js';
import { Network } from '@prisma/client';

export class PublisherFactory {
  private static publishers: Map<string, Publisher> = new Map([
    [Network.FACEBOOK, new FacebookPublisher()],
    [Network.INSTAGRAM, new InstagramPublisher()],
    [Network.THREADS, new ThreadsPublisher()],
    [Network.LINKEDIN, new LinkedInPublisher()],
    [Network.YOUTUBE, new YouTubePublisher()],
    [Network.X, new XPublisher()],
    [Network.TIKTOK, new TikTokPublisher()],
    [Network.PINTEREST, new PinterestPublisher()],
  ]);

  static getPublisher(network: Network | string): Publisher {
    const publisher = this.publishers.get(network);
    if (!publisher) {
      throw new Error(`No publisher registered for network: ${network}`);
    }
    return publisher;
  }

  static registerPublisher(network: string, publisher: Publisher): void {
    this.publishers.set(network, publisher);
  }
}
