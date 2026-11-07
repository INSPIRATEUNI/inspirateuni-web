-- Datos iniciales del catálogo. Van en migración porque los schemas declarativos no admiten INSERT.
-- Revisar contra la lista oficial vigente.
insert into public.faculties (name) values
  ('Facultad de Arquitectura, Urbanismo y Artes'),
  ('Facultad de Ciencias'),
  ('Facultad de Ingeniería Ambiental'),
  ('Facultad de Ingeniería Civil'),
  ('Facultad de Ingeniería Eléctrica y Electrónica'),
  ('Facultad de Ingeniería Económica, Estadística y Ciencias Sociales'),
  ('Facultad de Ingeniería Geológica, Minera y Metalúrgica'),
  ('Facultad de Ingeniería Industrial y de Sistemas'),
  ('Facultad de Ingeniería Mecánica'),
  ('Facultad de Ingeniería de Petróleo, Gas Natural y Petroquímica'),
  ('Facultad de Ingeniería Química y Textil')
on conflict (name) do nothing;

insert into public.careers (faculty_id, name)
select f.id, c.career
from (values
  ('Facultad de Arquitectura, Urbanismo y Artes', 'Arquitectura'),
  ('Facultad de Arquitectura, Urbanismo y Artes', 'Urbanismo'),
  ('Facultad de Ciencias', 'Ciencia de la Computación'),
  ('Facultad de Ciencias', 'Física'),
  ('Facultad de Ciencias', 'Ingeniería Física'),
  ('Facultad de Ciencias', 'Matemática'),
  ('Facultad de Ciencias', 'Química'),
  ('Facultad de Ingeniería Ambiental', 'Ingeniería Ambiental'),
  ('Facultad de Ingeniería Ambiental', 'Ingeniería Sanitaria'),
  ('Facultad de Ingeniería Ambiental', 'Ingeniería de Higiene y Seguridad Industrial'),
  ('Facultad de Ingeniería Civil', 'Ingeniería Civil'),
  ('Facultad de Ingeniería Eléctrica y Electrónica', 'Ingeniería Eléctrica'),
  ('Facultad de Ingeniería Eléctrica y Electrónica', 'Ingeniería Electrónica'),
  ('Facultad de Ingeniería Eléctrica y Electrónica', 'Ingeniería de Telecomunicaciones'),
  ('Facultad de Ingeniería Eléctrica y Electrónica', 'Ingeniería de Ciberseguridad'),
  ('Facultad de Ingeniería Eléctrica y Electrónica', 'Ingeniería de Biomédica'),
  ('Facultad de Ingeniería Económica, Estadística y Ciencias Sociales', 'Ingeniería Económica'),
  ('Facultad de Ingeniería Económica, Estadística y Ciencias Sociales', 'Ingeniería Estadística'),
  ('Facultad de Ingeniería Geológica, Minera y Metalúrgica', 'Ingeniería Geológica'),
  ('Facultad de Ingeniería Geológica, Minera y Metalúrgica', 'Ingeniería de Minas'),
  ('Facultad de Ingeniería Geológica, Minera y Metalúrgica', 'Ingeniería Metalúrgica'),
  ('Facultad de Ingeniería Industrial y de Sistemas', 'Ingeniería Industrial'),
  ('Facultad de Ingeniería Industrial y de Sistemas', 'Ingeniería de Sistemas'),
  ('Facultad de Ingeniería Industrial y de Sistemas', 'Ingeniería de Software'),
  ('Facultad de Ingeniería Industrial y de Sistemas', 'Ingeniería de Inteligencia Artificial'),
  ('Facultad de Ingeniería Mecánica', 'Ingeniería Mecánica'),
  ('Facultad de Ingeniería Mecánica', 'Ingeniería Mecánica-Eléctrica'),
  ('Facultad de Ingeniería Mecánica', 'Ingeniería Naval'),
  ('Facultad de Ingeniería Mecánica', 'Ingeniería Mecatrónica'),
  ('Facultad de Ingeniería Mecánica', 'Ingeniería Aereoespacial'),
  ('Facultad de Ingeniería de Petróleo, Gas Natural y Petroquímica', 'Ingeniería de Petróleo y Gas Natural'),
  ('Facultad de Ingeniería de Petróleo, Gas Natural y Petroquímica', 'Ingeniería Petroquímica'),
  ('Facultad de Ingeniería Química y Textil', 'Ingeniería Química'),
  ('Facultad de Ingeniería Química y Textil', 'Ingeniería Textil')
) as c (faculty, career)
join public.faculties f on f.name = c.faculty
on conflict (faculty_id, name) do nothing;
