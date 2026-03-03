import { Routes, Route, Navigate } from 'react-router-dom';
import { WorkflowList } from './pages/WorkflowList';
import { WorkflowEditor } from './pages/WorkflowEditor';
import { ExecutionList } from './pages/ExecutionList';
import { ExecutionDetail } from './pages/ExecutionDetail';
import { HITLList } from './pages/HITLList';
import { CredentialsList } from './pages/CredentialsList';
import { CustomNodeList } from './pages/CustomNodeList';
import { CustomNodeEditor } from './pages/CustomNodeEditor';

function App() {
  return (
    <div className="h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<Navigate to="/workflows" replace />} />
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<WorkflowEditor />} />
        <Route path="/workflows/:id" element={<WorkflowEditor />} />
        <Route path="/executions" element={<ExecutionList />} />
        <Route path="/executions/:id" element={<ExecutionDetail />} />
        <Route path="/hitl" element={<HITLList />} />
        <Route path="/credentials" element={<CredentialsList />} />
        <Route path="/custom-nodes" element={<CustomNodeList />} />
        <Route path="/custom-nodes/new" element={<CustomNodeEditor />} />
        <Route path="/custom-nodes/:id/edit" element={<CustomNodeEditor />} />
      </Routes>
    </div>
  );
}

export default App;
