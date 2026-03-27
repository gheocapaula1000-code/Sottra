
ALTER TABLE public.territorial_dataset_jobs
  DROP CONSTRAINT territorial_dataset_jobs_dataset_type_check,
  DROP CONSTRAINT territorial_dataset_jobs_status_check;

ALTER TABLE public.territorial_dataset_jobs
  ADD CONSTRAINT territorial_dataset_jobs_dataset_type_check
    CHECK (dataset_type = ANY (ARRAY[
      'ASC_2021','R03_2021','R03_CSV_SEZ','R03_CSV_ASC1','R03_CSV_ASC2','R03_CSV_ASC3',
      'COMUNI_ITALIA','LOCALITA_ISTAT'
    ])),
  ADD CONSTRAINT territorial_dataset_jobs_status_check
    CHECK (status = ANY (ARRAY[
      'uploaded','validated','validating','ready_to_import','importing','imported','failed'
    ]));
