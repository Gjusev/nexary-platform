import ChatLayout from './chat-layout';
import { ChatProviders } from '@/components/chat/providers';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProviders>
      <ChatLayout />
    </ChatProviders>
  );
}
