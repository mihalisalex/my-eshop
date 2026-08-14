export interface MediaAsset {
  id: string;
  url: string;
  pathname: string;
  filename: string;
  altText?: string;
  folder?: string;
  tags: string[];
  contentType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  createdAt: string;
}

/** Where an asset is referenced. Empty means the asset is safe to delete. */
export interface MediaUsage {
  /** Human-readable location, e.g. "Product: Oxford Loafer". */
  label: string;
  /** Admin URL for the thing using it, so the admin can go unhook it. */
  href?: string;
}

export interface MediaAssetWithUsage extends MediaAsset {
  usage: MediaUsage[];
}
