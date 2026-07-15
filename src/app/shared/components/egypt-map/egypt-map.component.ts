import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  SimpleChanges,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MapInsight {
  city: string;
  bookings: number;
}

const EGYPT_CITIES: Record<string, [number, number]> = {
  'cairo':           [30.0444, 31.2357],
  'القاهرة':         [30.0444, 31.2357],
  'giza':            [30.0131, 31.2089],
  'الجيزة':          [30.0131, 31.2089],
  'alexandria':      [31.2001, 29.9187],
  'الإسكندرية':      [31.2001, 29.9187],
  'luxor':           [25.6872, 32.6396],
  'الأقصر':          [25.6872, 32.6396],
  'aswan':           [24.0889, 32.8998],
  'أسوان':           [24.0889, 32.8998],
  'port said':       [31.2565, 32.2841],
  'بورسعيد':         [31.2565, 32.2841],
  'suez':            [29.9668, 32.5498],
  'السويس':          [29.9668, 32.5498],
  'ismailia':        [30.5965, 32.2715],
  'الإسماعيلية':     [30.5965, 32.2715],
  'mansoura':        [31.0409, 31.3785],
  'المنصورة':        [31.0409, 31.3785],
  'tanta':           [30.7865, 31.0004],
  'طنطا':            [30.7865, 31.0004],
  'zagazig':         [30.5877, 31.5021],
  'الزقازيق':        [30.5877, 31.5021],
  'asyut':           [27.1783, 31.1859],
  'أسيوط':           [27.1783, 31.1859],
  'sohag':           [26.5591, 31.6957],
  'سوهاج':           [26.5591, 31.6957],
  'qena':            [26.1551, 32.7160],
  'قنا':             [26.1551, 32.7160],
  'fayoum':          [29.3084, 30.8428],
  'الفيوم':          [29.3084, 30.8428],
  'beni suef':       [29.0661, 31.0994],
  'بني سويف':        [29.0661, 31.0994],
  'minya':           [28.1099, 30.7503],
  'المنيا':          [28.1099, 30.7503],
  'damanhur':        [31.0341, 30.4683],
  'دمنهور':          [31.0341, 30.4683],
  'kafr el sheikh':  [31.1073, 30.9388],
  'كفر الشيخ':       [31.1073, 30.9388],
  'damietta':        [31.4165, 31.8133],
  'دمياط':           [31.4165, 31.8133],
  'sharm el sheikh': [27.9158, 34.3299],
  'شرم الشيخ':       [27.9158, 34.3299],
  'hurghada':        [27.2579, 33.8116],
  'الغردقة':         [27.2579, 33.8116],
  'new cairo':       [30.0290, 31.4697],
  'القاهرة الجديدة': [30.0290, 31.4697],
  '6th of october':  [29.9285, 30.9188],
  'السادس من أكتوبر':[29.9285, 30.9188],
  'maadi':           [29.9601, 31.2569],
  'المعادي':         [29.9601, 31.2569],
  'heliopolis':      [30.0921, 31.3219],
  'مصر الجديدة':     [30.0921, 31.3219],
  'nasr city':       [30.0626, 31.3361],
  'مدينة نصر':       [30.0626, 31.3361],
  'zamalek':         [30.0634, 31.2195],
  'الزمالك':         [30.0634, 31.2195],
  'dokki':           [30.0382, 31.2113],
  'الدقي':           [30.0382, 31.2113],
  'mohandessin':     [30.0509, 31.2000],
  'المهندسين':       [30.0509, 31.2000],
};

function resolveCity(name: string): [number, number] | null {
  return EGYPT_CITIES[name.trim().toLowerCase()] ?? null;
}

@Component({
  selector: 'app-egypt-map',
  standalone: true,
  imports: [CommonModule],
  // OnPush intentionally omitted — map DOM changes are outside Angular CD
  template: `
    <!-- Outer shell: fixed 280px height, clips everything inside -->
    <div class="map-shell">

      @if (hasData) {
        <!-- Leaflet mounts here. Must have an explicit pixel height. -->
        <div #mapEl class="map-el"></div>
      } @else {
        <div class="map-empty">
          <span class="material-symbols-outlined">location_off</span>
          <p class="map-empty-title">No location data</p>
          <p class="map-empty-sub">No city data available yet.</p>
        </div>
      }

    </div>
  `,
  styles: [`
    /* ── Shell: fixed height, hard clip ─────────────────────────── */
    .map-shell {
      position: relative;
      width: 100%;
      height: 280px;          /* explicit px — Leaflet can resolve this */
      overflow: hidden;        /* nothing escapes */
      border-radius: 0.75rem;
      background: #f0eded;
    }

    /* ── The actual Leaflet container ───────────────────────────── */
    .map-el {
      position: absolute;      /* fill shell exactly */
      inset: 0;
      width: 100%;
      height: 100%;
    }

    /* ── Empty state ─────────────────────────────────────────────── */
    .map-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 0.5rem;
    }
    .map-empty span {
      font-size: 2.5rem;
      color: #9ca3af;
    }
    .map-empty-title {
      font-weight: 600;
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
    }
    .map-empty-sub {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0;
    }
  `],
})
export class EgyptMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() insights: MapInsight[] = [];
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private map: any    = null;
  private markers: any[] = [];
  private L: any      = null;
  private initDone    = false;

  get hasData(): boolean {
    return this.insights.some(i => resolveCity(i.city) !== null);
  }

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (!this.hasData) return;

    this.zone.runOutsideAngular(() => {
      import('leaflet').then(mod => {
        this.L = mod.default ?? mod;
        this.destroyMap();   // safety: never double-init
        this.initMap();
        this.plotMarkers();
        this.initDone = true;
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['insights'] || changes['insights'].firstChange) return;

    if (this.initDone && this.map && this.L) {
      // Data changed while map already exists — just re-plot
      this.zone.runOutsideAngular(() => this.plotMarkers());
    } else if (!this.initDone && this.hasData && this.mapEl?.nativeElement) {
      // Data arrived after view init (async route) — bootstrap now
      this.zone.runOutsideAngular(() => {
        import('leaflet').then(mod => {
          this.L = mod.default ?? mod;
          this.destroyMap();
          this.initMap();
          this.plotMarkers();
          this.initDone = true;
        });
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  // ── Private helpers ──────────────────────────────────────────────

  private destroyMap(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null;
    }
    this.markers = [];
    this.initDone = false;
  }

  private initMap(): void {
    const el = this.mapEl?.nativeElement;
    if (!el || this.map) return;

    const L = this.L;

    this.map = L.map(el, {
      center:          [26.8206, 30.8025],
      zoom:            5,
      zoomControl:     true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    // invalidateSize after the shell's CSS has fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize({ animate: false });
      });
    });
  }

  private plotMarkers(): void {
    if (!this.map || !this.L) return;
    const L = this.L;

    // Remove old markers
    this.markers.forEach(m => { m.off(); m.remove(); });
    this.markers = [];

    const resolved = this.insights
      .map(i => ({ ...i, coords: resolveCity(i.city) }))
      .filter(i => i.coords !== null) as (MapInsight & { coords: [number, number] })[];

    if (!resolved.length) return;

    const maxBookings = Math.max(...resolved.map(r => r.bookings), 1);

    resolved.forEach(item => {
      const radius = 10 + (item.bookings / maxBookings) * 20;

      const circle = L.circleMarker(item.coords, {
        radius,
        fillColor:   '#0F766E',
        color:       '#ffffff',
        weight:      2,
        opacity:     1,
        fillOpacity: 0.75,
      }).addTo(this.map);

      circle.bindPopup(
        `<div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:110px;">
           <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#1b1c1c;">📍 ${item.city}</p>
           <p style="font-size:12px;margin:0;color:#3e4949;">
             <strong>${item.bookings}</strong> Booking${item.bookings !== 1 ? 's' : ''}
           </p>
         </div>`,
        { closeButton: false, className: 'sanad-popup' }
      );

      circle.on('mouseover', function(this: any) { this.openPopup(); });
      circle.on('mouseout',  function(this: any) { this.closePopup(); });

      this.markers.push(circle);
    });

    if (this.markers.length === 1) {
      this.map.setView(resolved[0].coords, 8);
    } else {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.25));
    }
  }
}
