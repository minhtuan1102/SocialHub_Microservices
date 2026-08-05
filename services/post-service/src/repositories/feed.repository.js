import prisma from '../config/db.js';

export const feedRepository = {
  getUserJoinedGroupIds: async (userId) => {
    if (!userId) return [];
    const memberships = await prisma.groupMember.findMany({
      where: {
        user_id: userId,
        status: 'approved'
      },
      select: {
        group_id: true
      }
    });
    return memberships.map(m => m.group_id);
  },

  getRecentPostsWithCursor: async (cursor, limit, allowedAuthorIds, joinedGroupIds = []) => {
    return await prisma.post.findMany({
      where: {
        OR: [
          {
            group_id: null,
            OR: [
              { visibility: 'public' },
              { visibility: null },
              {
                visibility: 'friends',
                author_id: { in: allowedAuthorIds }
              }
            ]
          },
          {
            group_id: { not: null },
            status: 'approved',
            OR: [
              { group: { privacy: 'public' } },
              { group_id: { in: joinedGroupIds } }
            ]
          }
        ]
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            privacy: true
          }
        }
      },
      take: limit,
      skip: 1, // Skip the cursor
      cursor: {
        id: cursor,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  },

  getRecentPostsWithOffset: async (limit, offset, allowedAuthorIds, joinedGroupIds = []) => {
    return await prisma.post.findMany({
      where: {
        OR: [
          {
            group_id: null,
            OR: [
              { visibility: 'public' },
              { visibility: null },
              {
                visibility: 'friends',
                author_id: { in: allowedAuthorIds }
              }
            ]
          },
          {
            group_id: { not: null },
            status: 'approved',
            OR: [
              { group: { privacy: 'public' } },
              { group_id: { in: joinedGroupIds } }
            ]
          }
        ]
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            privacy: true
          }
        }
      },
      take: limit,
      skip: offset,
      orderBy: {
        created_at: 'desc',
      },
    });
  }
};
