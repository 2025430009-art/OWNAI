import mongoose from 'mongoose';

const sceneImageSchema = new mongoose.Schema({
  sceneNumber: { type: Number, required: true },
  path: { type: String },
}, { _id: false });

const videoJobSchema = new mongoose.Schema({
  userId: { type: Number, default: null },
  prompt: { type: String, required: true },
  title: { type: String },
  mood: { type: String },
  script: { type: mongoose.Schema.Types.Mixed },
  sceneImages: { type: [sceneImageSchema], default: [] },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'queued',
  },
  progress: { type: Number, default: 0 },
  currentStep: { type: String },
  outputPath: { type: String },
  thumbnailPath: { type: String },
  durationSec: { type: Number },
  shareToken: { type: String, unique: true, sparse: true },
  error: { type: String },
}, {
  timestamps: true,
  collection: 'prompt_to_video_jobs',
});

videoJobSchema.index({ userId: 1, createdAt: -1 });
videoJobSchema.index({ shareToken: 1 });

export const VideoJob = mongoose.models.VideoJob
  || mongoose.model('VideoJob', videoJobSchema);

export default VideoJob;
