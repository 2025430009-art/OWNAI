export const VIDEO_QUALITY_OPTIONS = [
  { id: '480p', label: '480p SD', width: 854, height: 480 },
  { id: '720p', label: '720p HD', width: 1280, height: 720 },
  { id: '1080p', label: '1080p Full HD', width: 1920, height: 1080 },
];

export function resolveQuality(quality = '1080p') {
  return VIDEO_QUALITY_OPTIONS.find((q) => q.id === quality) || VIDEO_QUALITY_OPTIONS[2];
}
