/**
 * Kontent fayllari reyestri: Next.js (va brauzer) JSON'ni fayl tizimidan o'qiy olmaydi, shuning uchun
 * har bir fayl shu yerda statik import qilinadi. Kalit — `src/content` ga nisbatan yo'l (kengaytmasiz).
 * Yangi fayl qo'shilganda shu ro'yxatga ham qo'shing: `npm run content:validate` mosligini tekshiradi.
 */
import f0 from "./algebra/algebra-9/kvadrat-tenglamalar/chapter.json";
import f1 from "./algebra/algebra-9/kvadrat-tenglamalar/diskriminant.json";
import f2 from "./algebra/algebra-9/kvadrat-tenglamalar/kvadrat-tenglama.json";
import f3 from "./algebra/algebra-9/kvadrat-tenglamalar/toliqsiz-kvadrat-tenglamalar.json";
import f4 from "./algebra/algebra-9/kvadrat-tenglamalar/viyet-teoremasi.json";
import f5 from "./geometriya/geometry-9/uchburchaklar/chapter.json";
import f6 from "./geometriya/geometry-9/uchburchaklar/oxshashlik.json";
import f7 from "./geometriya/geometry-9/uchburchaklar/pifagor-teoremasi.json";
import f8 from "./geometriya/geometry-9/uchburchaklar/uchburchak-turlari.json";
import f9 from "./ingliz-tili/english-9/travel-and-tourism/chapter.json";
import f10 from "./ingliz-tili/english-9/travel-and-tourism/giving-directions.json";
import f11 from "./ingliz-tili/english-9/travel-and-tourism/present-perfect-past-simple.json";
import f12 from "./ingliz-tili/english-9/travel-and-tourism/travel-vocabulary.json";
import f13 from "./tarix/history-9/mustaqillik-yillari/chapter.json";
import f14 from "./tarix/history-9/mustaqillik-yillari/davlat-ramzlari-va-konstitutsiya.json";
import f15 from "./tarix/history-9/mustaqillik-yillari/milliy-valyuta.json";
import f16 from "./tarix/history-9/mustaqillik-yillari/mustaqillik-bayonoti.json";

export const CONTENT_REGISTRY: Record<string, unknown> = {
  "algebra/algebra-9/kvadrat-tenglamalar/chapter": f0,
  "algebra/algebra-9/kvadrat-tenglamalar/diskriminant": f1,
  "algebra/algebra-9/kvadrat-tenglamalar/kvadrat-tenglama": f2,
  "algebra/algebra-9/kvadrat-tenglamalar/toliqsiz-kvadrat-tenglamalar": f3,
  "algebra/algebra-9/kvadrat-tenglamalar/viyet-teoremasi": f4,
  "geometriya/geometry-9/uchburchaklar/chapter": f5,
  "geometriya/geometry-9/uchburchaklar/oxshashlik": f6,
  "geometriya/geometry-9/uchburchaklar/pifagor-teoremasi": f7,
  "geometriya/geometry-9/uchburchaklar/uchburchak-turlari": f8,
  "ingliz-tili/english-9/travel-and-tourism/chapter": f9,
  "ingliz-tili/english-9/travel-and-tourism/giving-directions": f10,
  "ingliz-tili/english-9/travel-and-tourism/present-perfect-past-simple": f11,
  "ingliz-tili/english-9/travel-and-tourism/travel-vocabulary": f12,
  "tarix/history-9/mustaqillik-yillari/chapter": f13,
  "tarix/history-9/mustaqillik-yillari/davlat-ramzlari-va-konstitutsiya": f14,
  "tarix/history-9/mustaqillik-yillari/milliy-valyuta": f15,
  "tarix/history-9/mustaqillik-yillari/mustaqillik-bayonoti": f16,
};
