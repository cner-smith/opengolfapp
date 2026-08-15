import { Link, useParams } from 'react-router-dom'
import {
  useEditorCourse,
  useEditorCourseTees,
  useEditorHoleTees,
  useEditorHoles,
} from '../../hooks/useCourseEditor'
import { CourseFieldsForm } from '../../components/dev-editor/CourseFieldsForm'
import { FacilityPicker } from '../../components/dev-editor/FacilityPicker'
import { OsmRefetchButton } from '../../components/dev-editor/OsmRefetchButton'
import { HolesEditor } from '../../components/dev-editor/HolesEditor'
import { TeesEditor } from '../../components/dev-editor/TeesEditor'

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>()
  const course = useEditorCourse(id)
  const holes = useEditorHoles(id)
  const tees = useEditorCourseTees(id)
  const holeTees = useEditorHoleTees(id)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link to="/dev/courses" className="text-caddie-accent" style={{ fontSize: 12 }}>
          ‹ Back to search
        </Link>
        {course.data && (
          <>
            <h1 className="font-serif text-caddie-ink" style={{ fontSize: 24, fontWeight: 500, marginTop: 6 }}>
              {course.data.name}
            </h1>
            <div className="text-caddie-ink-mute font-mono" style={{ fontSize: 11, marginTop: 4 }}>
              {course.data.id}
            </div>
          </>
        )}
      </div>

      {course.isLoading && (
        <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
          Loading…
        </div>
      )}
      {course.error && (
        <div className="text-caddie-neg" style={{ fontSize: 13 }}>
          Course not found.
        </div>
      )}

      {course.data && (
        <>
          <CourseFieldsForm course={course.data} />
          <FacilityPicker course={course.data} />
          <OsmRefetchButton courseId={course.data.id} lat={course.data.lat} lng={course.data.lng} />
          {holes.data && (
            <HolesEditor
              courseId={course.data.id}
              holes={holes.data}
              courseTees={tees.data ?? []}
              holeTees={holeTees.data ?? []}
              courseLocation={
                course.data.lat != null && course.data.lng != null
                  ? { lat: course.data.lat, lng: course.data.lng }
                  : null
              }
            />
          )}
          {tees.data && <TeesEditor courseId={course.data.id} tees={tees.data} />}
        </>
      )}
    </div>
  )
}
