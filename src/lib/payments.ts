import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://vtjqfzpfehfofamhowjz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0anFmenBmZWhmb2ZhbWhvd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDMxMTgsImV4cCI6MjA4NzIxOTExOH0.XShaoDlgVKT2LHk0fYOT5TWGgwkfn3bQQbuV2pcw_HM'
)
