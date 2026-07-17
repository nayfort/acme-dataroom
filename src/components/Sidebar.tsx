import { Database, Plus } from 'lucide-react'
import type { Dataroom } from '../types'
import { Button } from './Button'

interface SidebarProps {
  datarooms: Dataroom[]
  activeDataroomId: string
  itemCounts: Map<string, number>
  onSelect: (dataroomId: string) => void
  onCreate: () => void
}

export function Sidebar({
  datarooms,
  activeDataroomId,
  itemCounts,
  onSelect,
  onCreate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">
          <Database size={19} />
        </div>
        <div>
          <strong>Acme Dataroom</strong>
          <span>Due diligence workspace</span>
        </div>
      </div>

      <div className="sidebar__heading">
        <span>Datarooms</span>
        <Button
          aria-label="Create dataroom"
          size="icon"
          title="Create dataroom"
          variant="ghost"
          onClick={onCreate}
        >
          <Plus size={17} />
        </Button>
      </div>

      <nav className="room-list" aria-label="Datarooms">
        {datarooms.map((room) => (
          <button
            key={room.id}
            className={room.id === activeDataroomId ? 'room-list__item is-active' : 'room-list__item'}
            type="button"
            onClick={() => onSelect(room.id)}
          >
            <span>{room.name}</span>
            <small>{itemCounts.get(room.id) ?? 0} items</small>
          </button>
        ))}
      </nav>
    </aside>
  )
}
