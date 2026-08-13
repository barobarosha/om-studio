
import { SITE } from "@/lib/config";

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-semibold mb-6">Политика обработки персональных данных</h1>
      <div className="space-y-4 text-sm text-foreground/85 leading-relaxed">
        <p>Настоящая политика описывает порядок обработки персональных данных посетителей сайта {SITE.domain} (далее — «Сайт»), оператором которого является ОМ Студия (далее — «Оператор»).</p>
        <h2 className="font-semibold text-base">1. Какие данные мы собираем</h2>
        <p>Имя, номер телефона, адрес электронной почты и содержимое обращений, которые вы добровольно указываете в формах на Сайте, а также файлы (изображения, дизайн-проекты), которые вы прикрепляете к заявке.</p>
        <h2 className="font-semibold text-base">2. Цели обработки</h2>
        <p>Обработка заявок и обращений, проверка наличия товаров, консультации, подбор материалов, организация доставки, обратная связь по запросам пользователя.</p>
        <h2 className="font-semibold text-base">3. Правовые основания</h2>
        <p>Обработка осуществляется с согласия субъекта персональных данных, выраженного отправкой формы на Сайте, в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».</p>
        <h2 className="font-semibold text-base">4. Передача и хранение</h2>
        <p>Данные не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ. Срок хранения — не более необходимого для целей обработки.</p>
        <h2 className="font-semibold text-base">5. Права субъекта</h2>
        <p>Вы вправе запросить уточнение, блокирование или уничтожение своих персональных данных, направив запрос на {SITE.email}.</p>
        <h2 className="font-semibold text-base">6. Cookies и аналитика</h2>
        <p>На Сайте используется сервис Яндекс Метрика для анализа посещаемости. Собираемые данные обезличены и используются для улучшения работы Сайта.</p>
        <p className="text-muted-foreground">Редакция от {new Date().getFullYear()} г. Юридическая формулировка финализируется заказчиком перед запуском.</p>
      </div>
    </div>
  );
}


export function NotFoundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="font-display text-4xl font-semibold mb-3">404</h1>
      <p className="text-muted-foreground mb-6">Страница не найдена.</p>
      <a href="/" className="text-primary underline">На главную</a>
    </div>
  );
}
