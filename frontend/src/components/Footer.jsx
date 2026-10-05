import { Link } from "react-router-dom";
import { IconPin, IconPhone, IconMail, Logo } from "./Icons";

export default function Footer() {
  return (
    <footer className="mt-20 bg-marino text-white/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Logo />
              <span className="text-[16px] font-bold">EPSA MOTOR</span>
            </div>
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed">
              Distribuidor autorizado de motocars Bajaj. Autorizado oficial por Crosland Perú S.A.C.
            </p>
            <p className="mt-3 text-[12px] text-white/45">
              INVERSIONES EPSA MOTOR S.A.C. · RUC 20555595469
            </p>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-white">Sedes</h3>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li className="flex items-center gap-2"><IconPin /> Comas</li>
              <li className="flex items-center gap-2"><IconPin /> Ventanilla</li>
              <li className="flex items-center gap-2"><IconPin /> Puente Piedra</li>
            </ul>
            <Link to="/sedes" className="mt-3 inline-block text-[13px] font-medium text-white/80 underline-offset-4 hover:underline">
              Ver direcciones completas →
            </Link>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-white">Contacto</h3>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li className="flex items-center gap-2"><IconPhone /> +51 907 721 481</li>
              <li className="flex items-center gap-2"><IconMail /> inversionesepsamotor@gmail.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 EPSA Motor. Todos los derechos reservados.</span>
          <span>Datos de ejemplo del Sprint 1 · se validan con EPSA Motor antes del MVP.</span>
        </div>
      </div>
    </footer>
  );
}
