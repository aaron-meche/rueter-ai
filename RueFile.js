```javascript
import fs from 'node:fs';

export default class RueFile {
  constructor(source) {
    this._source = source.replace(/\r\n?|\n/g, '\n');
    this._len = this._source.length;
    this._pos = 0;
  }

  get _isAtEnd() {
    return this._pos >= this._len;
  }

  _skipWhitespace() {
    while (!this._isAtEnd && /\s/.test(this._source[this._pos])) {
      this._pos++;
    }
  }

  _skipComment() {
    if (this._pos + 1 < this._len && this._source[this._pos] === '/' && this._source[this._pos + 1] === '*') {
      this._pos += 2;
      while (!this._isAtEnd) {
        if (this._source[this._pos] === '*' && this._pos + 1 < this._len && this._source[this._pos + 1] === '/') {
          this._pos += 2;
          break;
        }
        this._pos++;
      }
    }
  }

  _skipTrivia() {
    while (true) {
      this._skipWhitespace();
      this._skipComment();
      if (this._isAtEnd || (this._source[this._pos] !== '/' || this._source[this._pos + 1] !== '*')) {
        break;
      }
    }
  }

  _peek(offset = 0) {
    const i = this._pos + offset;
    return i < this._len ? this._source[i] : '';
  }

  _consume(expected) {
    const c = this._peek();
    if (c === expected) {
      this._pos++;
      return true;
    }
    return false;
  }

  _readContentUntil(stops) {
    let buf = '';
    while (!this._isAtEnd) {
      const c = this._peek();
      if (stops.includes(c)) {
        break;
      }
      if (c === '/' && this._peek(1) === '*') {
        this._skipComment();
        continue;
      }
      buf += c;
      this._pos++;
    }
    return buf;
  }

  _computeFullSelector(parent, rawChild) {
    let child = rawChild.replace(/\s+/g, ' ').trim();
    if (!child) return '';
    if (child.includes('&')) {
      child = child.replace(/&/g, parent.trim()).replace(/\s+/g, ' ').trim();
      return child;
    }
    const firstChar = child.charAt(0);
    const directAppend = ['>', '+', '~', ':'].includes(firstChar);
    return parent.trim() + (directAppend ? '' : ' ') + child;
  }

  _parseDeclaration(rule) {
    const propStart = this._pos;
    this._skipTrivia();
    const propBuf = this._readContentUntil([':']);
    const colonPos = this._pos;
    const prop = this._source.slice(propStart, colonPos).replace(/\s+/g, ' ').trim();
    if (!prop || !this._consume(':')) {
      this._pos = propStart;
      return false;
    }
    const valBuf = this._readContentUntil([';', '}']);
    const val = valBuf.replace(/\s+/g, ' ').trim();
    const decl = `${prop}: ${val};`;
    rule.declarations.push(decl);
    if (this._peek() === ';') {
      this._consume(';');
    }
    return true;
  }

  _parseBlock(rule) {
    while (!this._isAtEnd) {
      this._skipTrivia();
      if (this._peek() === '}') {
        this._consume('}');
        return;
      }
      const savedPos = this._pos;
      if (this._parseDeclaration(rule)) {
        continue;
      }
      this._pos = savedPos;
      const nestedRule = this._parseRule(rule.selector);
      if (nestedRule) {
        rule.nested.push(nestedRule);
      } else {
        // Skip malformed
        while (!this._isAtEnd && this._peek() !== ';' && this._peek() !== '}') {
          this._pos++;
        }
        if (this._peek() === ';') {
          this._consume(';');
        }
      }
    }
  }

  _parseRule(parentSelector) {
    const savedPos = this._pos;
    const rawSel = this._readContentUntil(['{']);
    if (this._peek() !== '{') {
      this._pos = savedPos;
      return null;
    }
    const selTrim = rawSel.trim();
    if (!selTrim) {
      this._pos = savedPos;
      return null;
    }
    if (selTrim.startsWith('@