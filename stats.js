var Stats = function() {
    function s(a, g, d) {
        
        var f, c, e;
        
        for(c = 0; c < 30; c++) {
            
            for(f = 0; f < 73; f++) {
                e = (f + c * 74) * 4, a[e] = a[e + 4], a[e + 1] = a[e + 5], a[e + 2] = a[e + 6];
            }
            
            for(c = 0; c < 30; c++) {
                e = (73 + c * 74) * 4, c < g ? (a[e] = b[d].bg.r, a[e + 1] = b[d].bg.g, a[e + 2] = b[d].bg.b) : (a[e] = b[d].fg.r, a[e + 1] = b[d].fg.g, a[e + 2] = b[d].fg.b);
            }
		}
    }
}