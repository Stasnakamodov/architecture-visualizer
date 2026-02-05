import Link from 'next/link';
import Image from 'next/image';
import type { Project } from '@/types/canvas';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg dark:hover:shadow-gray-950 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
    >
      <div className="aspect-video relative bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {project.thumbnail_url ? (
          <Image
            src={project.thumbnail_url}
            alt={project.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800">
            <svg
              className="w-16 h-16 text-gray-300 dark:text-gray-600"
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
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
          {project.name}
        </h3>

        {project.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
            {project.description}
          </p>
        )}

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-md"
              >
                {tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="px-2 py-0.5 text-gray-400 dark:text-gray-500 text-xs">
                +{project.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
