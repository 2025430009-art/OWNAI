import { useState, useEffect, useCallback } from 'react';
import { listResearchProjects } from '../api/client.js';

const STORAGE_KEY = 'ownai-active-research-project';

export default function useResearchProject() {
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listResearchProjects();
      const active = (data.projects || []).filter((p) => p.status === 'active');
      setProjects(active);

      const savedId = localStorage.getItem(STORAGE_KEY);
      const selected = active.find((p) => p.id === savedId) || active[0] || null;
      setProject(selected);
      if (selected) {
        localStorage.setItem(STORAGE_KEY, selected.id);
      }
    } catch (err) {
      setError(err.message);
      setProjects([]);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveProject = useCallback((projectId) => {
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setProject(found);
      localStorage.setItem(STORAGE_KEY, found.id);
    }
  }, [projects]);

  return {
    project,
    projects,
    activeCount: projects.length,
    loading,
    error,
    refresh,
    setActiveProject,
  };
}
