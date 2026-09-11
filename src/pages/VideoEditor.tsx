import { VideoEditor as Editor } from '../editor/VideoEditor';
import { usePipeline } from '../context/PipelineContext';
export default function VideoEditor({visible}: {visible: boolean}) {
  const { sharedScenarioId } = usePipeline();
  return <Editor visible={visible} sourceId={sharedScenarioId} />;
}
