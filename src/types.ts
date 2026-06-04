export interface NyaaRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
  nyaaSession?: string;
  site?: "nyaa" | "sukebei";
}

export interface NyaaResponse {
  status: number;
  headers: Record<string, string>;
  body: string | ArrayBuffer;
}

export interface Torrent {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  comments: number;
  downloads: number;
  seeders: number;
  leechers: number;
  size: string;
  uploadDate: string;
  magnet: string;
  download: string;
  infoHash: string | null;
  trusted: boolean;
  remake: boolean;
  anonymous: boolean;
}

export interface SearchResult {
  torrents: Torrent[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
  };
}

export interface User {
  username: string;
  title: string | null;
  uploads: number | null;
}

export interface Comment {
  id: number;
  pos: number;
  username: string;
  text: string;
  timestamp: string;
  role: string | null;
  avatar: string | null;
}

export interface TorrentDetail {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  comments: Comment[];
  downloads: number;
  seeders: number;
  leechers: number;
  size: string;
  uploadDate: string;
  uploader: string;
  magnet: string;
  download: string;
  infoHash: string | null;
  trackers: string[] | string[][];
  trusted: boolean;
  remake: boolean;
  anonymous: boolean;
  description: string;
  information: string | null;
  fileList: FileNode[];
}

export interface FileNode {
  name: string;
  size: string | null;
  type: "file" | "dir";
  children?: FileNode[];
}

export interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
  };
}
