import ModuleTabs from '../../components/ModuleTabs.jsx'

// Hand-over queue, active exit restrictions, bus arrivals and settings live
// behind their own tabs on this page.
export default function AdminModules({ date, onChanged }) {
  return (
    <div className="content">
      <ModuleTabs date={date} onChanged={onChanged} />
    </div>
  )
}
