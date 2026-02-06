import SurveyTable from '@/components/SurveyTable';

export default function AnalysisPage() {
  return (
    // 周りの余白(p-8)と白背景(bg-white)を完全に排除
    <div className="bg-black min-h-screen">
      <SurveyTable />
    </div>
  );
}