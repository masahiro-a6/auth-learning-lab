export interface ScimUser {
  id: string
  userName: string
  displayName: string
  active: boolean
  title: string
  department: string
  emails: { value: string; primary: boolean }[]
  name: { givenName: string; familyName: string; formatted: string }
  meta: { created: string; lastModified: string }
}

export interface ScimEvent {
  id: string
  ts: number
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  status: number
  note: string
  req: Record<string, unknown> | null
  res: Record<string, unknown>
}
