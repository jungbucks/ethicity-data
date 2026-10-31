/* 구역별 무대 소품. 코스와 판정에 관여하지 않는다. */
(function (root) {
  'use strict';
  function create(view) {
    var scene = view.scene, roofs = [], bridge = new THREE.Group(), puddles = new THREE.Group();
    scene.add(bridge); scene.add(puddles);
    view.buildings.forEach(function (b) {
      var p = b.geometry.parameters;
      var roof = new THREE.Mesh(new THREE.ConeGeometry(p.width * 0.8, 3, 4), new THREE.MeshBasicMaterial({ color: 0x587883, wireframe: true }));
      roof.rotation.y = Math.PI / 4; roof.position.y = p.height / 2 + 1.5; b.add(roof); roofs.push(roof);
    });
    for (var i = 0; i < 10; i++) {
      var frame = new THREE.Group(); frame.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        var pillar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 8, 2), new THREE.MeshBasicMaterial({ color: 0x334354 }));
        pillar.position.set(side * 6.5, 4, 0);
        pillar.add(new THREE.LineSegments(new THREE.EdgesGeometry(pillar.geometry), new THREE.LineBasicMaterial({ color: 0x739097 })));
        frame.add(pillar);
      });
      var deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 20), new THREE.MeshBasicMaterial({ color: 0x283443 })); deck.position.y = 8; frame.add(deck); bridge.add(frame);
      var pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: 0x719cae, transparent: true, opacity: 0.4, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.scale.set(1.5, 2, 1); pool.position.set(i % 2 ? 2.7 : -2.7, 0.04, -i * 19); puddles.add(pool);
    }
    var positions = new Float32Array(180 * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb6d2e2, transparent: true, opacity: 0.5 })); rain.frustumCulled = false; scene.add(rain);
    var current = null;
    function update(id, z, t, reduced) {
      var day = id === 'S1' || id === 'S2';
      if (id !== current) {
        current = id;
        var sky = day ? (id === 'S1' ? 0xb6cfdb : 0xc9dce4) : id === 'S4' ? 0x101b28 : 0x17223f;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        view.buildings.forEach(function (b, i) {
          b.scale.y = day ? (id === 'S1' ? 0.25 : 0.4) : 1;
          b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(day ? 0x657f8d : 0x17223d);
          b.children[0].material.color.setHex(day ? 0xd6e8e9 : [0x69ccdc, 0x8a9cda, 0xb6a9d9][i % 3]);
          roofs[i].visible = id === 'S1';
        });
        bridge.visible = id === 'S4'; puddles.visible = !day; rain.visible = !day;
      }
      bridge.position.z = -Math.floor(z / 20) * 20 + 20;
      puddles.position.z = -Math.floor(z / 19) * 19 + 19;
      if (!day) {
        for (var j = 0; j < 180; j++) {
          var x = ((j * 73) % 220) / 10 - 11, y = 13 - ((j * 0.73 + (reduced ? 0 : t * 10)) % 13), d = (j * 17) % 95;
          positions.set([x, y, -z - d, x - 0.15, y - 0.85, -z - d + 0.1], j * 6);
        }
        geo.attributes.position.needsUpdate = true;
      }
    }
    return { update: update };
  }
  root.DR.RunScenery = { create: create };
})(window);
