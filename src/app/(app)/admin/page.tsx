import { redirect } from 'next/navigation';

export default function AdminRootPage() {
  // The root admin page just redirects to the first available admin section.
  redirect('/admin/projects');
}
