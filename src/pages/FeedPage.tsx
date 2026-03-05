import React from 'react';
import PostCard from '../components/PostCard';

interface Post {
  id: string;
  content?: string;
  timestamp: string;
  profile?: {
    username?: string;
  };
  [key: string]: any;
}

interface FeedPageProps {
  posts: Post[];
  loading?: boolean;
  error?: string | null;
}

const FeedPage: React.FC<FeedPageProps> = ({ posts, loading, error }) => {
  if (loading) {
    return (
      <div className="w-full max-w-2xl space-y-6 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-5 animate-pulse space-y-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-800" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-800 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center py-6">{error}</p>;
  }

  if (posts.length === 0) {
    return <p className="text-gray-500 text-center py-10">No hay posts todavía.</p>;
  }

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 px-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

export default FeedPage;
