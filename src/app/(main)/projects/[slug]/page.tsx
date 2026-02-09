import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// Demo data - will be replaced with Supabase
const demoProjects: Record<
  string,
  {
    name: string;
    description: string;
    tags: string[];
  }
> = {
  'b2b-trade-platform': {
    name: 'B2B Trade Platform',
    description:
      'International trade platform with 7-step constructor and 120+ API endpoints.',
    tags: ['Next.js', 'Supabase', 'React Flow'],
  },
  'database-schema': {
    name: 'Database Schema',
    description:
      'Supabase database architecture with 15+ tables and RLS policies.',
    tags: ['PostgreSQL', 'Supabase', 'RLS'],
  },
  'state-management': {
    name: 'State Management',
    description: 'React state architecture using Context API and TanStack Query.',
    tags: ['React', 'TanStack Query', 'Zustand'],
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = demoProjects[slug];

  if (!project) {
    return {
      title: 'Project Not Found',
    };
  }

  return {
    title: `${project.name} | VatmanPro`,
    description: project.description,
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = demoProjects[slug];

  if (!project) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <a href="/projects" className="hover:text-gray-900 dark:hover:text-gray-100">
            Projects
          </a>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">{project.name}</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{project.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{project.description}</p>

        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Placeholder for canvas viewer */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-16 text-center">
        <svg
          className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Canvas Preview
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Connect Supabase to load canvas data for this project
        </p>
        <a
          href="/import"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          Or import a new canvas
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
