ALTER TABLE public.picspeak_assignments
DROP CONSTRAINT picspeak_assignments_time_limit_check;

ALTER TABLE public.picspeak_assignments
ADD CONSTRAINT picspeak_assignments_time_limit_check
CHECK (
  (mode = 'picflash' AND time_limit IN (3, 5, 10, 30, 45, 60))
  OR
  (mode <> 'picflash' AND time_limit IN (30, 45, 60))
);
