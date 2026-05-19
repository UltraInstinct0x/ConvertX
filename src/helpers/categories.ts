// Maps output file extensions to user-facing categories.
// Used by the "new UI" to group convert targets semantically
// (Video/Image/Audio/Document) instead of by underlying tool
// (ffmpeg/imagemagick/libreoffice).

export type Category =
  | "Image"
  | "Video"
  | "Audio"
  | "Document"
  | "Ebook"
  | "Vector"
  | "3D"
  | "Data"
  | "Archive"
  | "Other";

const CATEGORY_MAP: Record<Category, string[]> = {
  Video: [
    "mp4", "mov", "mkv", "avi", "webm", "wmv", "flv", "m4v",
    "mpg", "mpeg", "3gp", "ogv", "ts", "vob", "asf", "rm", "rmvb", "f4v",
  ],
  Audio: [
    "mp3", "wav", "flac", "aac", "ogg", "m4a", "opus", "wma",
    "aiff", "aif", "ac3", "amr", "au", "mka", "oga", "voc", "caf",
  ],
  Image: [
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif",
    "avif", "heic", "heif", "jxl", "ico", "tga", "pbm", "pgm", "ppm",
    "pnm", "exr", "hdr", "dds", "psd", "xcf", "raw", "cr2", "nef",
    "arw", "dng", "rw2", "orf", "raf", "pcx", "sgi", "xpm",
  ],
  Vector: [
    "svg", "eps", "ai", "emf", "wmf", "cgm", "dxf",
  ],
  Document: [
    "pdf", "doc", "docx", "odt", "txt", "md", "rtf", "html", "htm",
    "tex", "rst", "epub", "fodt", "ott", "uot", "wps", "abw", "lwp",
    "pages", "key", "ppt", "pptx", "odp", "fodp", "otp", "xls", "xlsx",
    "ods", "fods", "ots", "csv", "tsv", "msg", "eml", "vcf", "ics",
  ],
  Ebook: [
    "mobi", "azw", "azw3", "azw4", "fb2", "lit", "lrf", "pdb",
    "kfx", "kepub", "snb", "pml", "rb", "tcr", "txtz",
  ],
  "3D": [
    "obj", "stl", "ply", "fbx", "dae", "gltf", "glb", "3ds",
    "blend", "x3d", "amf", "off", "x", "iqe", "iqm", "md2", "md3", "md5",
  ],
  Data: [
    "json", "yaml", "yml", "xml", "toml", "ini", "hcl",
  ],
  Archive: [
    "zip", "tar", "gz", "bz2", "7z", "rar", "xz", "zst",
  ],
  Other: [],
};

// Build a reverse lookup once.
const EXT_TO_CATEGORY: Record<string, Category> = {};
for (const [cat, exts] of Object.entries(CATEGORY_MAP) as [Category, string[]][]) {
  for (const ext of exts) {
    EXT_TO_CATEGORY[ext.toLowerCase()] = cat;
  }
}

export const CATEGORY_ORDER: Category[] = [
  "Image",
  "Video",
  "Audio",
  "Document",
  "Vector",
  "Ebook",
  "3D",
  "Data",
  "Archive",
  "Other",
];

export const categoryFor = (ext: string): Category => {
  const clean = ext.trim().toLowerCase().replace(/^\./, "");
  return EXT_TO_CATEGORY[clean] ?? "Other";
};

// Group {converter: [targets]} into {category: [{target, converter}]}.
export const groupByCategory = (
  byConverter: Record<string, string[]>,
): Record<Category, { target: string; converter: string }[]> => {
  const out: Record<Category, { target: string; converter: string }[]> = {
    Image: [], Video: [], Audio: [], Document: [], Vector: [],
    Ebook: [], "3D": [], Data: [], Archive: [], Other: [],
  };
  const seen: Record<Category, Set<string>> = {
    Image: new Set(), Video: new Set(), Audio: new Set(), Document: new Set(),
    Vector: new Set(), Ebook: new Set(), "3D": new Set(), Data: new Set(),
    Archive: new Set(), Other: new Set(),
  };
  for (const [converter, targets] of Object.entries(byConverter)) {
    for (const target of targets) {
      const cat = categoryFor(target);
      // Dedupe by target within a category; keep first converter that produces it.
      if (!seen[cat].has(target)) {
        seen[cat].add(target);
        out[cat].push({ target, converter });
      }
    }
  }
  // Sort targets alphabetically inside each category for stable UI.
  for (const cat of CATEGORY_ORDER) {
    out[cat].sort((a, b) => a.target.localeCompare(b.target));
  }
  return out;
};
