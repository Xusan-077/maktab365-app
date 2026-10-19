import type { Book, Grade } from "@/types/catalog";
import { lt } from "./localized";

const ORDINALS_EN = ["", "1st", "2nd", "3rd"];

const AUTHORS = lt("Mualliflar jamoasi", "Коллектив авторов", "Team of authors");

function book(
  grade: Grade,
  subjectId: string,
  title: [string, string, string],
  publishedYear: number,
  edition: number,
  topicsReady = false,
): Book {
  return {
    id: `${subjectId}-${grade}`,
    title: lt(...title),
    grade,
    subjectId,
    author: AUTHORS,
    publishedYear,
    edition: lt(`${edition}-nashr`, `${edition}-е издание`, `${ORDINALS_EN[edition]} edition`),
    // Haqiqiy fayl yo'q: example.org — mock uchun ajratilgan domen
    ...(topicsReady && { pdfUrl: `https://example.org/pdf/${subjectId}-${grade}.pdf` }),
    topicsReady,
  };
}

export const BOOKS: Book[] = [
  book(1, "mother-tongue", ["Alifbe", "Азбука", "Alphabet book"], 2020, 1),
  book(1, "math", ["Matematika. 1-sinf", "Математика. 1 класс", "Mathematics. Grade 1"], 2020, 2),
  book(
    2,
    "mother-tongue",
    ["Ona tili. 2-sinf", "Родной язык. 2 класс", "Mother tongue. Grade 2"],
    2021,
    1,
  ),
  book(2, "math", ["Matematika. 2-sinf", "Математика. 2 класс", "Mathematics. Grade 2"], 2021, 2),
  book(3, "math", ["Matematika. 3-sinf", "Математика. 3 класс", "Mathematics. Grade 3"], 2021, 1),
  book(
    4,
    "mother-tongue",
    ["Ona tili. 4-sinf", "Родной язык. 4 класс", "Mother tongue. Grade 4"],
    2019,
    3,
  ),
  book(5, "math", ["Matematika. 5-sinf", "Математика. 5 класс", "Mathematics. Grade 5"], 2020, 2),
  book(5, "history", ["Tarix. 5-sinf", "История. 5 класс", "History. Grade 5"], 2020, 1),
  book(6, "math", ["Matematika. 6-sinf", "Математика. 6 класс", "Mathematics. Grade 6"], 2022, 1),
  book(6, "biology", ["Biologiya. 6-sinf", "Биология. 6 класс", "Biology. Grade 6"], 2022, 1),
  book(7, "algebra", ["Algebra. 7-sinf", "Алгебра. 7 класс", "Algebra. Grade 7"], 2022, 1),
  book(7, "geometry", ["Geometriya. 7-sinf", "Геометрия. 7 класс", "Geometry. Grade 7"], 2022, 1),
  book(7, "physics", ["Fizika. 7-sinf", "Физика. 7 класс", "Physics. Grade 7"], 2022, 1),
  book(8, "algebra", ["Algebra. 8-sinf", "Алгебра. 8 класс", "Algebra. Grade 8"], 2019, 2),
  book(8, "geometry", ["Geometriya. 8-sinf", "Геометрия. 8 класс", "Geometry. Grade 8"], 2019, 2),
  book(8, "chemistry", ["Kimyo. 8-sinf", "Химия. 8 класс", "Chemistry. Grade 8"], 2019, 1),
  book(9, "algebra", ["Algebra. 9-sinf", "Алгебра. 9 класс", "Algebra. Grade 9"], 2019, 3, true),
  book(
    9,
    "geometry",
    ["Geometriya. 9-sinf", "Геометрия. 9 класс", "Geometry. Grade 9"],
    2019,
    3,
    true,
  ),
  book(
    9,
    "english",
    ["Ingliz tili. 9-sinf", "Английский язык. 9 класс", "English. Grade 9"],
    2020,
    2,
    true,
  ),
  book(
    9,
    "history",
    [
      "O'zbekiston tarixi. 9-sinf",
      "История Узбекистана. 9 класс",
      "History of Uzbekistan. Grade 9",
    ],
    2019,
    1,
    true,
  ),
  book(9, "physics", ["Fizika. 9-sinf", "Физика. 9 класс", "Physics. Grade 9"], 2019, 2),
  book(10, "algebra", ["Algebra. 10-sinf", "Алгебра. 10 класс", "Algebra. Grade 10"], 2022, 1),
  book(10, "physics", ["Fizika. 10-sinf", "Физика. 10 класс", "Physics. Grade 10"], 2022, 1),
  book(11, "history", ["Tarix. 11-sinf", "История. 11 класс", "History. Grade 11"], 2018, 2),
  book(
    11,
    "informatics",
    ["Informatika. 11-sinf", "Информатика. 11 класс", "Computer science. Grade 11"],
    2018,
    1,
  ),
];
