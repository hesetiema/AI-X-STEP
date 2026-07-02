// sidepanel/components/PipelineUploader.tsx
// Pipeline 上传组件 —— 选择 AI 生成的 tracelens-pipeline.ts，解析并注册到 content script

import React, { useRef } from 'react';
import { COLORS, SPACING, panelStyles } from '../styles';
import { useSidePanelStore } from '../store';
import { useSidePanelActions } from '../store/use-sidepanel-actions';
import type { TracelensPipeline } from '@/shared/types';

function parsePipelineModule(source: string): TracelensPipeline | null {
  // Pipeline 模块结构: export const xxx = definePipeline({ ... });
  // 去掉 export 关键字便于 eval
  const cleaned = source
    .replace(/export\s+(const|let|var)\s+\w+\s*=\s*definePipeline/g, 'var __pipeline = definePipeline')
    .replace(/import\s+.*?from\s+['"].*?['"]\s*;?/g, '');

  try {
    let pipeline: TracelensPipeline | null = null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const definePipeline = (p: TracelensPipeline): TracelensPipeline => {
      pipeline = p;
      return p;
    };
    void definePipeline;
    eval(cleaned);
    return pipeline;
  } catch (e) {
    console.error('[TraceLens] pipeline parse error:', e);
    return null;
  }
}

const PipelineUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pipelineFileName = useSidePanelStore((s) => s.pipelineFileName);
  const pipelineRoute = useSidePanelStore((s) => s.pipelineRoute);
  const pipelineResult = useSidePanelStore((s) => s.pipelineResult);
  const { registerPipeline, runPipelineCheck } = useSidePanelActions();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const source = reader.result as string;
      const pipeline = parsePipelineModule(source);
      if (!pipeline) {
        alert('解析失败：文件中未找到 definePipeline 调用');
        return;
      }
      const fields = Object.keys(pipeline.fields).length;
      console.log('[TraceLens] pipeline parsed:', pipeline.route, fields, 'fields');
      void registerPipeline(pipeline, file.name);
    };
    reader.onerror = () => {
      alert('文件读取失败');
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleRun = () => {
    void runPipelineCheck();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
      {/* Upload button / Info */}
      <div style={panelStyles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <span style={{ fontSize: 14 }}>📊</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.text }}>Page Pipeline</span>
            {pipelineFileName && (
              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                {pipelineFileName}
              </span>
            )}
          </div>
          <button
            onClick={handleUpload}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 500,
              border: `1px solid ${COLORS.primary}`,
              borderRadius: 4,
              background: 'transparent',
              color: COLORS.primary,
              cursor: 'pointer',
            }}
          >
            {pipelineFileName ? '更换' : '加载'}
          </button>
        </div>

        {pipelineRoute && (
          <div style={{ marginTop: SPACING.xs, fontSize: 11, color: COLORS.textSecondary }}>
            路由: {pipelineRoute}
          </div>
        )}
      </div>

      {/* Run button */}
      {pipelineFileName && (
        <button
          onClick={handleRun}
          disabled={!!pipelineResult}
          style={{
            width: '100%',
            padding: `${SPACING.sm}px 0`,
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            background: pipelineResult ? COLORS.muted : COLORS.primary,
            color: '#fff',
            cursor: pipelineResult ? 'default' : 'pointer',
          }}
        >
          {pipelineResult ? '诊断已完成' : '运行诊断'}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ts,.js"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
};

export default PipelineUploader;
