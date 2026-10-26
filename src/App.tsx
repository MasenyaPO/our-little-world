import { Questions } from './features/questions/Questions';
import { BucketList } from './features/bucketlist/BucketList';
import { Notes } from './features/notes/Notes';
import { Memories } from './features/memories/Memories';
import { ImportantDates } from './features/dates/ImportantDates';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { useRelationship } from './hooks/useRelationship';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './features/dashboard/Dashboard';

// This intercepts users who are logged in, but haven't created/joined a space
const RelationshipGuard = ({ children }: { children: React.ReactNode }) => {
  const { relationshipId, loading } = useRelationship();

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading space...</div>;
  if (!relationshipId) return <Onboarding />;

  return <>{children}</>;
};

// A helper wrapper to apply both protections and the global layout
const AppRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <RelationshipGuard>
      <AppLayout>
        {children}
      </AppLayout>
    </RelationshipGuard>
  </ProtectedRoute>
);

// Placeholder screens for future stages
const PlaceholderScreen = ({ title }: { title: string }) => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <h2 style={{ color: 'var(--color-primary)' }}>{title}</h2>
    <p>This feature will be built in an upcoming stage.</p>
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected App Routes */}
      <Route path="/" element={<AppRoute><Dashboard /></AppRoute>} />
      <Route path="/dates" element={<AppRoute><ImportantDates /></AppRoute>} />
      <Route path="/memories" element={<AppRoute><Memories /></AppRoute>} />
      <Route path="/notes" element={<AppRoute><Notes /></AppRoute>} />
      <Route path="/bucket-list" element={<AppRoute><BucketList /></AppRoute>} />
      <Route path="/questions" element={<AppRoute><Questions /></AppRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;