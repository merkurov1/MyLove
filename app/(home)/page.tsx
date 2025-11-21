import ChatAssistant from '@/components/ChatAssistant';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-black">
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl p-4">
        <ChatAssistant />
      </div>
    </div>
  );
}