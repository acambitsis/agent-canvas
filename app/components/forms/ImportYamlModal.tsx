/**
 * ImportYamlModal - Modal for importing legacy YAML files
 */

'use client';

import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';
import { useMutation } from '@/hooks/useConvex';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from '@/components/ui/Icon';
import { prepareYamlImport, extractTitleFromYaml } from '@/utils/yaml';
import { api } from '../../../convex/_generated/api';

interface ImportYamlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (canvasId: string) => void;
}

export function ImportYamlModal({ isOpen, onClose, onSuccess }: ImportYamlModalProps) {
  const { currentOrgId } = useAuth();
  const { canvases, setCurrentCanvasId } = useCanvas();
  const executeOperation = useAsyncOperation();

  const createCanvasMutation = useMutation(api.canvases.create);
  const bulkCreateAgentsMutation = useMutation(api.agents.bulkCreate);

  const [yamlText, setYamlText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
      setError('Please select a YAML file (.yaml or .yml)');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const text = await file.text();
      setYamlText(text);

      // Extract title for suggestion
      const title = extractTitleFromYaml(text);
      if (title) {
        setSuggestedTitle(title);
        if (!customTitle) {
          setCustomTitle(title);
        }
      }
    } catch (e: any) {
      setError(`Failed to read file: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!yamlText) {
      setError('Please select a YAML file first');
      return;
    }

    if (!currentOrgId) {
      setError('No organization selected');
      return;
    }

    setError(null);

    await executeOperation(
      async () => {
        // Get existing slugs to avoid conflicts
        const existingSlugs = new Set(canvases.map(c => c.slug));

        // Prepare import data
        const { title, slug, agents, phases, categories } = prepareYamlImport({
          yamlText,
          overrideTitle: customTitle,
          existingSlugs,
        });

        // Create canvas with phases/categories from YAML
        const canvasId = await createCanvasMutation({
          workosOrgId: currentOrgId,
          title,
          slug,
          phases,
          categories,
        });

        // Bulk create agents if any exist
        if (agents.length > 0) {
          await bulkCreateAgentsMutation({
            canvasId,
            agents,
          });
        }

        // Success! Navigate to the new canvas
        setCurrentCanvasId(canvasId);
        if (onSuccess) {
          onSuccess(canvasId);
        }
      },
      {
        loadingMessage: 'Importing YAML...',
        successMessage: 'Canvas imported successfully',
        errorMessage: 'Failed to import YAML',
        onSuccess: handleClose,
        onError: (error) => setError(error.message),
      }
    );
  };

  const handleClose = () => {
    setYamlText('');
    setCustomTitle('');
    setSuggestedTitle('');
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import from YAML">
      <div className="modal__body">
        {/* File Input */}
        <div className="form-group">
          <label className="form-label">YAML File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleBrowseClick}
            disabled={isLoading}
          >
            <Icon name="upload" />
            <span>{yamlText ? 'Change File' : 'Choose File'}</span>
          </button>
          {yamlText && (
            <p className="form-help" style={{ marginTop: '0.5rem' }}>
              File loaded successfully
            </p>
          )}
        </div>

        {/* Title Override */}
        {yamlText && (
          <div className="form-group">
            <label htmlFor="canvas-title" className="form-label">
              Canvas Title
            </label>
            {suggestedTitle && (
              <p className="form-help" style={{ marginBottom: '0.5rem' }}>
                Suggested: {suggestedTitle}
              </p>
            )}
            <input
              id="canvas-title"
              type="text"
              className="form-input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Enter canvas title"
              disabled={isLoading}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert--error u-mt-4">
            {error}
          </div>
        )}

        {/* Help Text */}
        <div className="alert alert--info u-mt-4">
          <p style={{ margin: 0 }}>
            <strong>Legacy YAML Import:</strong> This is a one-way import. The YAML file will be
            converted to Convex-native storage. All future editing happens in the app.
          </p>
        </div>
      </div>

      <div className="modal__footer">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleClose}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleImport}
          disabled={!yamlText || isLoading}
        >
          {isLoading ? 'Importing...' : 'Import'}
        </button>
      </div>
    </Modal>
  );
}
