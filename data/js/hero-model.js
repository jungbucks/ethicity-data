/*
 * 주인공 3D 모델(공통 팩 온유·다온 → fal.ai, tools/hero-3d.mjs). 데이터 = assets/models/hero-<id>.js 의 DR.heroModelData[id].
 * build(id): 텍스처 입힌 모델을 { group, legs:[왼,오] } 로. 통짜 모델이라 엉덩이 아래 삼각형을 왼·오 다리로 떼어
 *   엉덩이 높이를 축으로 흔든다(뒤에서만 보이는 러너라 이 정도로 달리는 느낌이 난다). 데이터가 없으면 null → 도형 러너.
 * 좌표: 바닥 y=0, 키 HEIGHT, 얼굴은 -Z(달리는 방향)·등은 +Z(카메라 쪽).
 */
(function (root) {
  'use strict';

  var DR = root.DR = root.DR || {};
  var HEIGHT = 2.0, HIP = 0.24; // 키, 엉덩이 높이(키에 대한 비율 — 2등신 치비라 다리가 짧다)

  function bytes(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function u16(b64) { var b = bytes(b64); return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2); }
  function unpack(q, min, max) {
    var dim = min.length, out = new Float32Array(q.length);
    for (var i = 0; i < q.length; i++) { var k = i % dim; out[i] = min[k] + q[i] / 65535 * (max[k] - min[k]); }
    return out;
  }
  function decode(d) {
    var ib = bytes(d.index);
    return {
      position: unpack(u16(d.position), d.posMin, d.posMax),
      uv: unpack(u16(d.uv), d.uvMin, d.uvMax),
      index: d.indexType === 'u32' ? new Uint32Array(ib.buffer, ib.byteOffset, ib.byteLength / 4) : u16(d.index)
    };
  }

  // 삼각형 목록(원래 정점 번호)으로 따로 선 기하를 만든다. shift = 그 조각의 축(피벗) 위치를 원점으로 옮김
  function piece(THREE, g, tris, shift) {
    var map = {}, pos = [], uv = [], idx = [];
    tris.forEach(function (v) {
      if (map[v] === undefined) {
        map[v] = pos.length / 3;
        pos.push(g.position[v * 3] - shift[0], g.position[v * 3 + 1] - shift[1], g.position[v * 3 + 2] - shift[2]);
        uv.push(g.uv[v * 2], g.uv[v * 2 + 1]);
      }
      idx.push(map[v]);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }

  function build(id) {
    var THREE = root.THREE, d = DR.heroModelData && DR.heroModelData[id];
    if (!THREE || !d) return null;
    var g = decode(d), s = HEIGHT / d.posMax[1];
    for (var i = 0; i < g.position.length; i++) g.position[i] *= s;
    var hip = HEIGHT * HIP, body = [], left = [], right = [];
    for (var t = 0; t < g.index.length; t += 3) {
      var a = g.index[t], b = g.index[t + 1], c = g.index[t + 2];
      var cy = (g.position[a * 3 + 1] + g.position[b * 3 + 1] + g.position[c * 3 + 1]) / 3;
      var cx = (g.position[a * 3] + g.position[b * 3] + g.position[c * 3]) / 3;
      (cy < hip ? (cx < 0 ? left : right) : body).push(a, b, c);
    }
    var img = new Image(); img.src = d.texture;
    var tex = new THREE.Texture(img);
    img.onload = function () { tex.needsUpdate = true; };
    tex.flipY = false; // glTF UV 원점(왼쪽 위)
    if ('colorSpace' in tex) tex.colorSpace = 'srgb'; else tex.encoding = THREE.sRGBEncoding;
    var mat = new THREE.MeshBasicMaterial({ map: tex }); // 러너 세상은 조명 없는 평면 색 — 텍스처 색 그대로

    var group = new THREE.Group();
    group.add(new THREE.Mesh(piece(THREE, g, body, [0, 0, 0]), mat));
    var legs = [left, right].map(function (tris, k) {
      var pivot = new THREE.Group(), x = (k ? 1 : -1) * 0.12;
      pivot.position.set(x, hip, 0);
      pivot.add(new THREE.Mesh(piece(THREE, g, tris, [x, hip, 0]), mat));
      group.add(pivot);
      return pivot;
    });
    return { group: group, legs: legs, triangles: d.triangles };
  }

  DR.HeroModel = { build: build, ids: ['onyu', 'daon'], names: { onyu: '온유', daon: '다온' }, HEIGHT: HEIGHT };
})(window);
