import MainTabs from '../components/MainTabs'

export default function Billing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <MainTabs />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-lg font-semibold">賬單</div>
          <div className="mt-1 text-sm text-slate-600">暫時未接入收費系統。</div>
        </div>
      </div>
    </div>
  )
}

