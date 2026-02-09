import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PublicPresentation } from '@/components/presentation/PublicPresentation';
import type { Database } from '@/lib/supabase/types';

type PublicPresentationRow = Database['public']['Tables']['public_presentations']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type CanvasRow = Database['public']['Tables']['canvases']['Row'];

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: publicPres } = await supabase
    .from('public_presentations')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single() as { data: PublicPresentationRow | null };

  if (!publicPres) {
    return { title: 'Presentation Not Found' };
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name, presentations')
    .eq('id', publicPres.project_id)
    .single() as { data: { name: string; presentations: any[] } | null };

  if (!project) {
    return { title: 'Presentation Not Found' };
  }

  const presentations = project.presentations || [];
  const presentation = presentations.find(
    (p: any) => p.id === publicPres.presentation_id
  );

  return {
    title: presentation
      ? `${presentation.name} | ${project.name} | VatmanPro`
      : `${project.name} | VatmanPro`,
    description: `Architecture presentation — ${project.name}`,
  };
}

export default async function PublicPresentationPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  // Look up the public presentation by slug
  const { data: publicPres } = await supabase
    .from('public_presentations')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single() as { data: PublicPresentationRow | null };

  if (!publicPres) {
    notFound();
  }

  // Load the project to get canvas data and presentations
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', publicPres.project_id)
    .single() as { data: ProjectRow | null };

  if (!project) {
    notFound();
  }

  // Load the primary canvas
  const { data: canvas } = await supabase
    .from('canvases')
    .select('*')
    .eq('project_id', project.id)
    .eq('is_primary', true)
    .single() as { data: CanvasRow | null };

  if (!canvas) {
    notFound();
  }

  // Find the specific presentation
  const presentations = (project.presentations as any[]) || [];
  const presentation = presentations.find(
    (p: any) => p.id === publicPres.presentation_id
  );

  if (!presentation) {
    notFound();
  }

  const canvasData = canvas.canvas_data as any;

  // Resolve scenarios referenced by the presentation
  const allScenarios = canvasData?.scenarios || canvasData?.data?.scenarios || [];
  const scenarioIds = new Set(presentation.scenarioIds || []);
  const presentationScenarios = allScenarios.filter(
    (s: any) => scenarioIds.has(s.id)
  );

  return (
    <PublicPresentation
      nodes={canvasData?.nodes || canvasData?.data?.nodes || []}
      edges={canvasData?.edges || canvasData?.data?.edges || []}
      presentation={{ ...presentation, scenarios: presentationScenarios }}
    />
  );
}
