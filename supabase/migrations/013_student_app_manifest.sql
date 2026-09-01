-- Allow version manifests next to APK objects in student-apps.

update storage.buckets
set allowed_mime_types = array[
  'application/vnd.android.package-archive',
  'application/octet-stream',
  'application/json'
]
where id = 'student-apps';
