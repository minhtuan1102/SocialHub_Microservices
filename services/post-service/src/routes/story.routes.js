import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as StoryController from '../controllers/story.controller.js';

const router = express.Router();

router.use(requireAuth);

router.post('/stories', StoryController.createStory);
router.get('/stories/feed', StoryController.getFeedStories);
router.get('/stories/me', StoryController.getMyStories);
router.post('/stories/:id/view', StoryController.viewStory);
router.get('/stories/:id/viewers', StoryController.getStoryViewers);
router.delete('/stories/:id', StoryController.deleteStory);

export default router;
