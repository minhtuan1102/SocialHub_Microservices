import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getUserProfile, validateMediaIds } from '../utils/api.js';
import axios from 'axios';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error.statusCode) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

// 1. Tạo Story mới (Hiệu lực 24 giờ)
export const createStory = async (req, res) => {
  try {
    const { mediaId, mediaType = 'image', caption } = req.body;
    const authorId = req.user.id;
    const token = req.headers.authorization;

    if (!mediaId) {
      return errorResponse(res, 400, 'Story must have a media file (mediaId)');
    }

    const isValidMedia = await validateMediaIds([mediaId], token);
    if (!isValidMedia) {
      return errorResponse(res, 400, 'Invalid or non-existent media file');
    }

    const createdAt = new Date();
    // Tin (Story) không có thời hạn hết hạn - user có thể tự xóa khi muốn
    // expires_at được set xa vào tương lai để không bao giờ tự động ẩn
    const expiresAt = new Date('2099-12-31T23:59:59.000Z');

    const story = await prisma.story.create({
      data: {
        author_id: authorId,
        media_id: mediaId,
        media_type: mediaType,
        caption: caption || null,
        created_at: createdAt,
        expires_at: expiresAt,
        view_count: 0
      }
    });

    const author = await getUserProfile(authorId, token);

    return successResponse(res, 201, {
      ...story,
      author
    });
  } catch (error) {
    return handleError(res, error, 'Create Story Error');
  }
};

// 2. Lấy danh sách Feed Stories (bạn bè + chính mình, chưa hết hạn)
export const getFeedStories = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const token = req.headers.authorization;

    // Lấy danh sách friendIds từ friend-service
    let allowedAuthorIds = [currentUserId];
    try {
      const friendServiceUrl = process.env.FRIEND_SERVICE_URL || 'http://friend-service:5000';
      const friendRes = await axios.get(`${friendServiceUrl}/api/friends/internal/${currentUserId}`);
      if (friendRes.data && friendRes.data.success && Array.isArray(friendRes.data.friendIds)) {
        allowedAuthorIds = [currentUserId, ...friendRes.data.friendIds];
      }
    } catch (err) {
      console.error('❌ Error fetching friends for stories feed:', err.message);
    }

    // Lấy tất cả stories (không có thời hạn hết hạn) của mình và bạn bè
    const stories = await prisma.story.findMany({
      where: {
        author_id: { in: allowedAuthorIds }
      },
      include: {
        views: {
          where: { user_id: currentUserId }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    // Group stories by author_id
    const storiesByAuthorMap = new Map();

    for (const story of stories) {
      const authorId = story.author_id;
      if (!storiesByAuthorMap.has(authorId)) {
        storiesByAuthorMap.set(authorId, []);
      }
      const hasViewed = story.views.length > 0;
      const { views, ...storyData } = story;
      storiesByAuthorMap.get(authorId).push({
        ...storyData,
        hasViewed
      });
    }

    // Resolve author profiles
    const storyGroups = [];
    for (const [authorId, authorStories] of storiesByAuthorMap.entries()) {
      const author = await getUserProfile(authorId, token);
      const hasUnviewed = authorStories.some((s) => !s.hasViewed);

      storyGroups.push({
        author,
        stories: authorStories,
        hasUnviewed
      });
    }

    // Sort storyGroups: User hiện tại luôn lên đầu, sau đó đến các user có story chưa xem
    storyGroups.sort((a, b) => {
      if (a.author.id === currentUserId) return -1;
      if (b.author.id === currentUserId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    return successResponse(res, 200, storyGroups);
  } catch (error) {
    return handleError(res, error, 'Get Feed Stories Error');
  }
};

// 3. Lấy Stories của chính mình
export const getMyStories = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const token = req.headers.authorization;

    const stories = await prisma.story.findMany({
      where: {
        author_id: currentUserId
      },
      orderBy: { created_at: 'desc' }
    });

    const author = await getUserProfile(currentUserId, token);

    return successResponse(res, 200, {
      author,
      stories
    });
  } catch (error) {
    return handleError(res, error, 'Get My Stories Error');
  }
};

// 4. Ghi nhận xem Story
export const viewStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const currentUserId = req.user.id;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      return errorResponse(res, 404, 'Story not found');
    }

    // Đã hết hạn?
    if (story.expires_at < new Date()) {
      return errorResponse(res, 410, 'Story has expired');
    }

    // Nếu không phải chính tác giả tự xem story của mình, ghi nhận lượt xem
    if (story.author_id !== currentUserId) {
      let isNewView = false;
      try {
        await prisma.storyView.create({
          data: {
            story_id: storyId,
            user_id: currentUserId
          }
        });
        isNewView = true;
      } catch (e) {
        // Đã xem rồi (unique constraint error [story_id, user_id])
      }

      if (isNewView) {
        await prisma.story.update({
          where: { id: storyId },
          data: { view_count: { increment: 1 } }
        });
      }
    }

    return successResponse(res, 200, { message: 'Story view recorded' });
  } catch (error) {
    return handleError(res, error, 'View Story Error');
  }
};

// 5. Lấy danh sách người đã xem Story (Chỉ chủ sở hữu xem được)
export const getStoryViewers = async (req, res) => {
  try {
    const storyId = req.params.id;
    const currentUserId = req.user.id;
    const token = req.headers.authorization;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      return errorResponse(res, 404, 'Story not found');
    }

    if (story.author_id !== currentUserId) {
      return errorResponse(res, 403, 'Chỉ tác giả mới có quyền xem danh sách người đã xem story');
    }

    const views = await prisma.storyView.findMany({
      where: { story_id: storyId },
      orderBy: { viewed_at: 'desc' }
    });

    const viewers = await Promise.all(
      views.map(async (v) => {
        const user = await getUserProfile(v.user_id, token);
        return {
          user,
          viewedAt: v.viewed_at
        };
      })
    );

    return successResponse(res, 200, viewers);
  } catch (error) {
    return handleError(res, error, 'Get Story Viewers Error');
  }
};

// 6. Xóa Story (Chỉ chủ sở hữu)
export const deleteStory = async (req, res) => {
  try {
    const id = req.params.id;
    const currentUserId = req.user.id;

    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) {
      return errorResponse(res, 404, 'Story not found');
    }

    if (story.author_id !== currentUserId) {
      return errorResponse(res, 403, 'Chỉ chủ sở hữu mới có quyền xóa story này');
    }

    await prisma.story.delete({ where: { id } });

    return successResponse(res, 200, { message: 'Đã xóa story thành công' });
  } catch (error) {
    return handleError(res, error, 'Delete Story Error');
  }
};
