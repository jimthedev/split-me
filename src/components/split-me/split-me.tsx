import { Component, Prop, State, Watch, Element, Event, EventEmitter } from '@stencil/core';

import { Cancelable } from 'lodash';
import throttle from 'lodash.throttle';

@Component({
  tag: 'split-me',
  styleUrl: 'split-me.css',
  shadow: false
})
export class SplitMe {

  @Element() el: HTMLElement;

  @Prop() n: number = 1;
  @Prop() d: 'horizontal' | 'vertical';
  @Prop() fixed: boolean = false;
  @Prop() sizes: string = '';
  @Prop() minSizes: string = '';
  @Prop() maxSizes: string = '';
  @Prop() throttle: number = 0;

  @State() slotEnd: number[];

  @Event() slotResized: EventEmitter;

  @Watch('n')
  watchN() {
    this.nChanged = true;
  }

  @Watch('sizes')
  watchSizes() {
    this.sizesChanged = true;
  }

  @Watch('minSizes')
  watchMinSizes() {
    this.minSizesChanged = true;
  }

  @Watch('maxSizes')
  watchMaxSizes() {
    this.maxSizesChanged = true;
  }

  @Watch('throttle')
  watchThrottle(curr: number) {
    this.throttledResize = throttle(this.resize.bind(this), curr);
  }

  throttledResize: Function & Cancelable;
  
  minSizesArr: number[];
  maxSizesArr: number[];
  nChanged: boolean = false;
  sizesChanged: boolean = false;
  minSizesChanged: boolean = false;
  maxSizesChanged: boolean = false;

  componentWillLoad() {
    this.throttledResize = throttle(this.resize.bind(this), this.throttle);
    // Validate the sizes attribute
    let sizes: number[] = this.parseSizes(this.sizes);
    if (sizes.length === this.n) {
      this.slotEnd = this.assignedSlotEnd(sizes);
    } else {
      this.slotEnd = this.defaultSlotEnd(this.n);
    }
    // Validate the minSize attribute
    let minSizes: number[] = this.parseSizes(this.minSizes);
    if (minSizes.length === this.n) {
      this.minSizesArr = minSizes;
    } else {
      this.minSizesArr = this.defaultMinSizes(this.n);
    }
    // Validate the maxSize attribute
    let maxSizes: number[] = this.parseSizes(this.maxSizes);
    if (maxSizes.length === this.n) {
      this.maxSizesArr = maxSizes;
    } else {
      this.maxSizesArr = this.defaultMaxSizes(this.n);
    }
  }

  componentWillUpdate() {
    // Validate the new sizes attribute
    let sizes: number[];
    if (this.sizesChanged) {
      sizes = this.parseSizes(this.sizes);
      if (sizes.length !== this.n) {
        this.sizesChanged = false;
      }
    }

    if (this.sizesChanged) {
      // If both sizes and n changed, size takes precedence to resize the splitter
      this.slotEnd = this.assignedSlotEnd(sizes);
      this.nChanged = false;
      this.sizesChanged = false;
    } else if (this.nChanged) {
      this.slotEnd = this.rescaleSlotEnd(this.n, this.slotEnd);
      this.nChanged = false;
    }

    if (this.minSizesChanged) {
      let minSizes: number[] = this.parseSizes(this.minSizes);
      if (minSizes.length === this.n) {
        this.minSizesArr = minSizes;
      } else {
        this.minSizesArr = this.defaultMinSizes(this.n);
      }
      this.minSizesChanged = false;
    }

    if (this.maxSizesChanged) {
      let maxSizes: number[] = this.parseSizes(this.minSizes);
      if (maxSizes.length === this.n) {
        this.maxSizesArr = maxSizes;
      } else {
        this.maxSizesArr = this.defaultMaxSizes(this.n);
      }
      this.maxSizesChanged = false;
    }
  }

  defaultSlotEnd(n: number) : number[] {
    let slotEnd: number[] = [];
    for (let i = 0; i < n; ++i) {
      slotEnd.push((i + 1) / n);
    }
    return slotEnd;
  }

  assignedSlotEnd(sizes: number[]) : number[] {
    let slotEnd: number[] = [];
    let currFrac = 0;
    for (let i = 0; i < sizes.length; ++i) {
      currFrac += sizes[i];
      slotEnd.push(Math.min(1, currFrac));
    }
    return slotEnd;
  }

  rescaleSlotEnd(n: number, oldEnd: number[]): number[] {
    let scale: number = oldEnd.length / n;
    let slotEnd: number[] = [];
    for (let i = 0; i < n - 1; ++i) {
      if (i < oldEnd.length) {
        slotEnd.push(oldEnd[i] * scale);
      } else {
        slotEnd.push((i + 1) / n);
      }
    }
    // The last slot should always expand to the end
    slotEnd.push(1);
    return slotEnd;
  }

  defaultMinSizes(n: number) : number[] {
    let minSizes: number[] = [];
    for (let i = 0; i < n; ++i) {
      minSizes.push(0);
    }
    return minSizes;
  }

  defaultMaxSizes(n: number) : number[] {
    let maxSizes: number[] = [];
    for (let i = 0; i < n; ++i) {
      maxSizes.push(1);
    }
    return maxSizes;
  }

  parseSizes(sizesStr: string) : number[] {
    if (!sizesStr) {
      return [];
    }
    let sizesStrArr: string[] = sizesStr.split(',');
    if (sizesStrArr.length !== this.n) {
      return [];
    }
    let sizes: number[] = [];
    const percentRegex: RegExp = /^\s*\d+(\.\d*)?\%\s*$/;
    const fracRegex: RegExp = /^\s*(0|1)(\.\d*)?\s*$/;
    for (let i = 0; i < sizesStrArr.length; ++i) {
      let str: string = sizesStrArr[i];
      if (str.match(percentRegex)) {
        sizes.push(parseFloat(str) / 100);
      } else if (str.match(fracRegex)) {
        sizes.push(parseFloat(str));
      } else {
        return [];
      }
    }
    return sizes;
  }

  onDragStart(event: DragEvent, i: number) {
    // Resize on desktop
    // Firefox wouldn't allow using drag events for resizing purposes,
    // use this workaround instead.
    event.preventDefault();
    let mouseMoveListener = (e: MouseEvent) => {
      this.throttledResize(e.clientX, e.clientY, i);
    }
    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', mouseMoveListener);
    });
  }

  onTouchMove = (event: TouchEvent, i: number) => {
    // Resize on mobile
    // Avoid scrolling the page
    event.preventDefault();
    if (event.touches.length > 0) {
      this.throttledResize(event.touches[0].clientX, event.touches[0].clientY, i);
    }
  }

  resize(x: number, y: number, i: number) {
    let start = i > 0 ? this.slotEnd[i - 1] : 0;
    let min = start + this.minSizesArr[i];
    min = Math.max(min, this.slotEnd[i + 1] - this.maxSizesArr[i + 1]);

    let max = i < this.n - 1 ? this.slotEnd[i + 1] : 1;
    max -= this.minSizesArr[i + 1];
    max = Math.min(max, start + this.maxSizesArr[i]);

    let frac: number;
    let rect = this.el.getBoundingClientRect();
    if (this.d === 'vertical') {
      frac = (y - rect.top ) / rect.height;
    } else {
      frac = (x - rect.left ) / rect.width;
    }

    if (frac > min && frac < max) {
      this.slotEnd = [...this.slotEnd.slice(0, i), frac, ...this.slotEnd.slice(i + 1) ];
      this.slotResized.emit(i);
    }
  }

  getSlotSize(i: number) : number {
    if (i === 0) {
      return this.slotEnd[i];
    } else {
      return this.slotEnd[i] - this.slotEnd[i - 1];
    }
  }

  render() {
    if (!this.slotEnd || this.slotEnd.length === 0) {
      return null;
    }
    
    let slotContainers = [];
    let slotDividers = [];
    let phantomDividers = [];

    for (let i = 0; i < this.n; ++i) {
      let containerId = `container${i}`;
      let slotName = `${i}`;
      let size: number = this.getSlotSize(i);
      let style;
      if (this.d === 'vertical') {
        style = {width: '100%', height: `${size * 100}%`};
      } else {
        style = {width: `${size * 100}%`, height: '100%'};
      }
      slotContainers.push(
        <div id={containerId} style={style}>
          <slot name={slotName} />
        </div>
      );
    }

    for (let i = 0; i < this.n - 1; ++i) {
      let style;
      let displayClasses: string;
      let phantomClasses: string;
      if (this.d === 'vertical') {
        style = {top: `${100 * this.slotEnd[i]}%`};
        displayClasses = 'divider-v display-divider-v';
        phantomClasses = 'divider-v phantom-divider-v';
      } else {
        style = {left: `${100 * this.slotEnd[i]}%`};
        displayClasses = 'divider-h display-divider-h';
        phantomClasses = 'divider-h phantom-divider-h';
      }
      slotDividers.push(
        <div class={displayClasses} style={style}>
        </div>
      );
      if (!this.fixed) {
        phantomDividers.push(
          <div class={phantomClasses}
            draggable={true}
            onDragStart={(e) => {this.onDragStart(e, i)}}
            onTouchMove={(e) => {this.onTouchMove(e, i)}}
            style={style}>
          </div>
        );
      }
    }

    return (
      <div class="top-container">
        <div class="dividers-container">
          {slotDividers}
          {phantomDividers}
        </div>
        <div class={this.d === 'vertical' ? 'slots-container-v' : 'slots-container-h'} >
          {slotContainers}
        </div>
      </div>
    );
  }
}
