import type { Subject } from "@/types/catalog";
import { lt } from "./localized";

export const SUBJECTS: Subject[] = [
  { id: "math", slug: "matematika", name: lt("Matematika", "Математика", "Mathematics") },
  { id: "algebra", slug: "algebra", name: lt("Algebra", "Алгебра", "Algebra") },
  { id: "geometry", slug: "geometriya", name: lt("Geometriya", "Геометрия", "Geometry") },
  { id: "english", slug: "ingliz-tili", name: lt("Ingliz tili", "Английский язык", "English") },
  {
    id: "mother-tongue",
    slug: "ona-tili",
    name: lt("Ona tili", "Родной язык", "Mother tongue"),
  },
  { id: "history", slug: "tarix", name: lt("Tarix", "История", "History") },
  { id: "physics", slug: "fizika", name: lt("Fizika", "Физика", "Physics") },
  { id: "chemistry", slug: "kimyo", name: lt("Kimyo", "Химия", "Chemistry") },
  { id: "biology", slug: "biologiya", name: lt("Biologiya", "Биология", "Biology") },
  {
    id: "informatics",
    slug: "informatika",
    name: lt("Informatika", "Информатика", "Computer science"),
  },
];
