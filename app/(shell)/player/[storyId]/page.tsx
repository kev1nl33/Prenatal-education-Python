import { PlayerView } from '@/components/player/PlayerView';

interface PlayerPageProps {
  params: { storyId: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PlayerPage({ params }: PlayerPageProps) {
  return <PlayerView storyId={decodeURIComponent(params.storyId)} />;
}
