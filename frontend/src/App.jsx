iimport React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows, Html } from '@react-three/drei';
// UPDATED: Imported IndianRupee instead of DollarSign
import { Layers, Activity, FileText, Info, Home, Box, Database, MousePointerClick, Type, Map, Monitor, Calculator, IndianRupee } from 'lucide-react';

// ==========================================
// COST CALCULATOR COMPONENT
// ==========================================
const CostEstimator = ({ geometry, materialsDb }) => {
  const { walls, slab } = geometry;
  const WALL_HEIGHT = 3.0; // Standard 3m wall height

  // Calculate total surface areas
  const { lbArea, partArea, slabArea } = useMemo(() => {
    const loadBearingLength = walls.filter(w => w.type === 'load_bearing').reduce((sum, w) => sum + w.length, 0);
    const partitionLength = walls.filter(w => w.type === 'partition').reduce((sum, w) => sum + w.length, 0);
    return {
      lbArea: loadBearingLength * WALL_HEIGHT,
      partArea: partitionLength * WALL_HEIGHT,
      slabArea: slab.width * slab.depth
    };
  }, [walls, slab]);

  // Filter materials by allowed use
  const lbMaterials = materialsDb.filter(m => m.allowed.includes('load_bearing'));
  const partMaterials = materialsDb.filter(m => m.allowed.includes('partition'));
  const slabMaterials = materialsDb.filter(m => m.allowed.includes('slab'));

  // State for selected materials
  const [selections, setSelections] = useState({
    lb: lbMaterials[0]?.name || '',
    part: partMaterials[0]?.name || '',
    slab: slabMaterials[0]?.name || ''
  });

  // Helper to get price
  const getPrice = (name) => materialsDb.find(m => m.name === name)?.unit_price || 0;

  // Calculate individual costs
  const lbCost = lbArea * getPrice(selections.lb);
  const partCost = partArea * getPrice(selections.part);
  const slabCost = slabArea * getPrice(selections.slab);
  const totalCost = lbCost + partCost + slabCost;

  return (
    <div style={{ marginTop: '30px', borderTop: '2px solid #334155', paddingTop: '20px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', marginBottom: '15px' }}>
        <Calculator size={20} color="#34d399"/> Interactive Cost Estimator
      </h3>
      
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
        
        {/* Load Bearing Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>Load Bearing Walls ({lbArea.toFixed(1)} m²)</div>
            <select 
              value={selections.lb} 
              onChange={(e) => setSelections({...selections, lb: e.target.value})}
              style={{ backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '5px', marginTop: '5px', width: '200px' }}
            >
              {lbMaterials.map(m => <option key={m.name} value={m.name}>{m.name} (₹{m.unit_price}/m²)</option>)}
            </select>
          </div>
          <div style={{ color: '#cbd5e1', fontWeight: 'bold' }}>₹{lbCost.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
        </div>

        {/* Partition Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>Partition Walls ({partArea.toFixed(1)} m²)</div>
            <select 
              value={selections.part} 
              onChange={(e) => setSelections({...selections, part: e.target.value})}
              style={{ backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '5px', marginTop: '5px', width: '200px' }}
            >
              {partMaterials.map(m => <option key={m.name} value={m.name}>{m.name} (₹{m.unit_price}/m²)</option>)}
            </select>
          </div>
          <div style={{ color: '#cbd5e1', fontWeight: 'bold' }}>₹{partCost.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
        </div>

        {/* Slab Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #334155' }}>
          <div>
            <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.9rem' }}>Floor Slab ({slabArea.toFixed(1)} m²)</div>
            <select 
              value={selections.slab} 
              onChange={(e) => setSelections({...selections, slab: e.target.value})}
              style={{ backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '5px', marginTop: '5px', width: '200px' }}
            >
              {slabMaterials.map(m => <option key={m.name} value={m.name}>{m.name} (₹{m.unit_price}/m²)</option>)}
            </select>
          </div>
          <div style={{ color: '#cbd5e1', fontWeight: 'bold' }}>₹{slabCost.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
        </div>

        {/* Total Cost */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.2rem' }}>
          <span style={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><IndianRupee size={20}/> Estimated Material Cost</span>
          <span style={{ color: '#34d399', fontWeight: 'bold' }}>₹{totalCost.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
        </div>
        
      </div>
    </div>
  );
};

// ==========================================
// INTERACTIVE 2D COMPONENT (HIGH FIDELITY)
// ==========================================
const FloorPlan2D = ({ geometry, activeWall, setActiveWall }) => {
  const { walls, slab, windows = [], stairs = [] } = geometry;
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const viewWidth = slab.width / zoom;
  const viewHeight = slab.depth / zoom;
  const minX = pan.x - viewWidth / 2;
  const minY = pan.y - viewHeight / 2;
  const viewBox = `${minX} ${minY} ${viewWidth} ${viewHeight}`;

  const handleWheel = (e) => {
    const delta = -e.deltaY * 0.002;
    setZoom((z) => Math.max(0.2, Math.min(z + delta, 10)));
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const { clientWidth, clientHeight } = e.currentTarget;
    const dx = (e.clientX - dragStart.x) * (viewWidth / clientWidth);
    const dy = (e.clientY - dragStart.y) * (viewHeight / clientHeight);
    setPan({ x: pan.x - dx, y: pan.y - dy });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#020617', position: 'relative', overflow: 'hidden' }}
         onWheel={handleWheel} onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); }}
         onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      
      {/* ZOOM CONTROLS */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'rgba(30,41,59,0.9)', padding: '15px', borderRadius: '8px', border: '1px solid #334155', backdropFilter: 'blur(4px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 'bold' }}>
          <span>Zoom</span><span style={{ color: '#38bdf8' }}>{(zoom * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min="0.2" max="5" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: '150px', cursor: 'pointer' }} />
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Reset View</button>
      </div>

      <svg viewBox={viewBox} style={{ width: '100%', height: '100%', filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.5))', cursor: isDragging ? 'grabbing' : 'grab' }}>
        
        {/* SVG Defs for Up-Arrow on Stairs */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#fb923c" />
          </marker>
        </defs>

        <rect x={-slab.width / 2} y={-slab.depth / 2} width={slab.width} height={slab.depth} fill="#1e293b" stroke="#334155" strokeWidth="0.1" />
        
        {/* Render High-Fidelity 2D Stairs */}
        {stairs.map((stair) => {
          const numSteps = Math.max(5, stair.steps || 5);
          return (
            <g key={stair.id} transform={`translate(${stair.position.x}, ${stair.position.z}) rotate(${-(stair.rotation * 180) / Math.PI})`}>
              <rect x={-stair.width / 2} y={-stair.depth / 2} width={stair.width} height={stair.depth} fill="#0f172a" stroke="#fb923c" strokeWidth="0.05" />
              {/* Draw individual stair step lines */}
              {Array.from({ length: numSteps }).map((_, i) => {
                const yPos = -stair.depth / 2 + (i * stair.depth) / numSteps;
                return <line key={i} x1={-stair.width / 2} y1={yPos} x2={stair.width / 2} y2={yPos} stroke="#fb923c" strokeWidth="0.02" />;
              })}
              {/* Draw directional 'UP' arrow */}
              <line x1={0} y1={-stair.depth / 2 + 0.2} x2={0} y2={stair.depth / 2 - 0.2} stroke="#fb923c" strokeWidth="0.04" markerEnd="url(#arrow)" />
            </g>
          );
        })}

        {/* Render Walls */}
        {walls.map((wall) => {
          const isActive = activeWall === wall.id;
          
          let baseColor = wall.type === "load_bearing" ? "#ef4444" : "#22c55e";
          if (isActive) baseColor = "#38bdf8";

          return (
            <g key={wall.id} transform={`translate(${wall.position.x}, ${wall.position.z}) rotate(${-(wall.rotation * 180) / Math.PI})`}
               onClick={(e) => { e.stopPropagation(); setActiveWall(isActive ? null : wall.id); }} style={{ cursor: 'pointer' }}>
              <rect x={-wall.length / 2} y={-0.1} width={wall.length} height={0.2} fill={baseColor} stroke={isActive ? "#0284c7" : "none"} strokeWidth={isActive ? 0.05 : 0} />
            </g>
          );
        })}

        {/* Render High-Fidelity 2D Windows */}
        {windows.map((win) => (
          <g key={win.id} transform={`translate(${win.position.x}, ${win.position.z}) rotate(${-(win.rotation * 180) / Math.PI})`}>
            <rect x={-win.length / 2} y={-0.1} width={0.1} height={0.2} fill="#38bdf8" />
            <rect x={win.length / 2 - 0.1} y={-0.1} width={0.1} height={0.2} fill="#38bdf8" />
            <line x1={-win.length / 2} y1={-0.03} x2={win.length / 2} y2={-0.03} stroke="#bae6fd" strokeWidth="0.02" />
            <line x1={-win.length / 2} y1={0.03} x2={win.length / 2} y2={0.03} stroke="#bae6fd" strokeWidth="0.02" />
          </g>
        ))}
      </svg>
    </div>
  );
};

// ==========================================
// INTERACTIVE 3D COMPONENT (HIGH FIDELITY)
// ==========================================
const FloorPlan3D = ({ geometry, activeWall, setActiveWall }) => {
  const [hoveredWall, setHoveredWall] = useState(null);
  const { walls, slab, windows = [], stairs = [] } = geometry;

  return (
    <group>
      <Grid infiniteGrid fadeDistance={50} sectionColor="#475569" cellColor="#334155" />
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[slab.width, slab.depth]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      {/* Walls */}
      {walls.map((wall) => {
        const isHovered = hoveredWall === wall.id;
        const isActive = activeWall === wall.id;
        
        let baseColor = wall.type === "load_bearing" ? "#ef4444" : "#22c55e";
        if (isActive) baseColor = "#38bdf8";
        else if (isHovered) baseColor = "#60a5fa";

        return (
          <mesh 
            key={wall.id} 
            position={[wall.position.x, 1.5, wall.position.z]} 
            rotation={[0, wall.rotation, 0]} 
            castShadow
            onPointerOver={(e) => { e.stopPropagation(); setHoveredWall(wall.id); }}
            onPointerOut={(e) => { e.stopPropagation(); setHoveredWall(null); }}
            onClick={(e) => { e.stopPropagation(); setActiveWall(isActive ? null : wall.id); }}
          >
            <boxGeometry args={[wall.length, 3, 0.2]} />
            <meshStandardMaterial color={baseColor} emissive={isActive ? "#0284c7" : "#000000"} emissiveIntensity={0.3}/>
            
            {isActive && (
              <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{ backgroundColor: 'rgba(15,23,42,0.9)', color: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #38bdf8', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                  <strong>{wall.type.replace('_', ' ').toUpperCase()}</strong><br/>
                  Length: {wall.length.toFixed(2)}m
                </div>
              </Html>
            )}
          </mesh>
        );
      })}

      {/* High-Fidelity 3D Windows */}
      {windows.map((win) => (
        <group key={win.id} position={[win.position.x, 1.5, win.position.z]} rotation={[0, win.rotation, 0]}>
          <mesh position={[0, 1.2, 0]}><boxGeometry args={[win.length, 0.1, 0.22]}/><meshStandardMaterial color="#1e293b"/></mesh>
          <mesh position={[0, -1.2, 0]}><boxGeometry args={[win.length, 0.1, 0.22]}/><meshStandardMaterial color="#1e293b"/></mesh>
          <mesh position={[-win.length/2 + 0.05, 0, 0]}><boxGeometry args={[0.1, 2.5, 0.22]}/><meshStandardMaterial color="#1e293b"/></mesh>
          <mesh position={[win.length/2 - 0.05, 0, 0]}><boxGeometry args={[0.1, 2.5, 0.22]}/><meshStandardMaterial color="#1e293b"/></mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[win.length - 0.1, 2.3, 0.05]} />
            <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.4} roughness={0.05} transmission={0.95} thickness={0.5} />
          </mesh>
        </group>
      ))}

      {/* High-Fidelity 3D Stairs */}
      {stairs.map((stair) => {
        const numSteps = Math.max(5, stair.steps || 5);
        const stepHeight = 3 / numSteps;
        const stepDepth = stair.depth / numSteps;

        return (
          <group key={stair.id} position={[stair.position.x, 0, stair.position.z]} rotation={[0, stair.rotation, 0]}>
            {Array.from({ length: numSteps }).map((_, i) => {
              const y = i * stepHeight;
              const z = (i * stepDepth) - (stair.depth/2) + (stepDepth/2);
              return (
                <group key={i}>
                  <mesh position={[0, y + stepHeight/2, z - stepDepth/2 + 0.02]} castShadow>
                    <boxGeometry args={[stair.width, stepHeight, 0.04]} />
                    <meshStandardMaterial color="#475569" />
                  </mesh>
                  <mesh position={[0, y + stepHeight, z]} castShadow>
                    <boxGeometry args={[stair.width + 0.04, 0.05, stepDepth + 0.04]} />
                    <meshStandardMaterial color="#fb923c" />
                  </mesh>
                </group>
              )
            })}
          </group>
        );
      })}

      <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
    </group>
  );
};

// ==========================================
// PAGE 1: WORKSPACE
// ==========================================
const Workspace = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeWall, setActiveWall] = useState(null);
  const [viewMode, setViewMode] = useState('3D'); 

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setActiveWall(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post('http://localhost:8000/api/process', formData, { timeout: 30000 });
      setData(response.data);
    } catch (error) {
      alert("Pipeline Failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100vw' }}>
      
      {/* LEFT: Viewport Workspace */}
      <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        <div style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10, display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: 'rgba(30,41,59,0.9)', borderRadius: '8px', border: '1px solid #334155', backdropFilter: 'blur(5px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Box size={20} color="#3b82f6"/> BIM Reconstructor</h1>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Load-Bearing (Red) | Partition (Green) | Windows (Glass)</p>
            </div>
            
            {data && (
              <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '4px', borderRadius: '6px', border: '1px solid #334155' }}>
                <button 
                  onClick={() => setViewMode('2D')} 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === '2D' ? '#3b82f6' : 'transparent', color: viewMode === '2D' ? 'white' : '#94a3b8' }}
                >
                  <Map size={16}/> 2D Plan
                </button>
                <button 
                  onClick={() => setViewMode('3D')} 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === '3D' ? '#3b82f6' : 'transparent', color: viewMode === '3D' ? 'white' : '#94a3b8' }}
                >
                  <Monitor size={16}/> 3D Model
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleUpload} style={{ display: 'flex', gap: '10px' }}>
            <input type="file" onChange={e => setFile(e.target.files[0])} style={{ fontSize: '0.8rem', padding: '5px', backgroundColor: '#0f172a', borderRadius: '4px', border: '1px solid #334155', color: 'white' }} />
            <button type="submit" disabled={loading || !file} style={{ padding: '8px 16px', backgroundColor: (loading || !file) ? '#1d4ed8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? 'Processing...' : 'Run Pipeline'}
            </button>
          </form>
        </div>

        <div style={{ flex: 1, backgroundColor: '#020617', position: 'relative' }} onClick={() => setActiveWall(null)}>
          {data ? (
            viewMode === '3D' ? (
              <Canvas camera={{ position: [0, 15, 20], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
                <Environment preset="city" />
                <FloorPlan3D geometry={data.geometry} activeWall={activeWall} setActiveWall={setActiveWall} />
                <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.1} />
              </Canvas>
            ) : (
              <FloorPlan2D geometry={data.geometry} activeWall={activeWall} setActiveWall={setActiveWall} />
            )
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#475569', flexDirection: 'column', gap: '10px' }}>
              <Layers size={48} strokeWidth={1} />
              <p>Upload a clean floor plan to initiate the pipeline</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Data Dashboard */}
      <div style={{ flex: '1 1 35%', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Activity size={20} color="#86efac"/> Project Intelligence</h2>
          {data && <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}><MousePointerClick size={14}/> Click walls to inspect</div>}
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!data && <p style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>Awaiting pipeline execution...</p>}
          
          {data && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', marginBottom: '15px' }}><Type size={20} color="#fbbf24"/> Detected Annotations (OCR)</h3>
                <div style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', fontStyle: 'italic' }}>
                  {data.ocr_text}
                </div>
              </div>

              {/* RENDER NEW COST CALCULATOR */}
              <CostEstimator geometry={data.geometry} materialsDb={data.materials_db} />

              <div style={{ marginTop: '30px', borderTop: '2px solid #334155', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' }}>Stage 04: Material Optimization</h3>
                {Object.entries(data.tradeoffs).map(([category, materials]) => (
                  <div key={category} style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                    <h3 style={{ textTransform: 'capitalize', color: '#38bdf8', margin: '0 0 10px 0', fontSize: '1.1rem' }}>{category.replace('_', ' ')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {materials.map((mat, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: i !== materials.length - 1 ? '1px solid #1e293b' : 'none' }}>
                          <span><strong>#{i+1}</strong> {mat.material}</span>
                          <span style={{ color: '#86efac', fontWeight: 'bold' }}>{mat.score.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '30px', borderTop: '2px solid #334155', paddingTop: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e2e8f0', marginBottom: '15px' }}><FileText size={20} color="#fca5a5"/> Stage 05: LLM Report</h3>
                <div style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  {data.explainability}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 2: MATERIAL DATABASE
// ==========================================
const DatabasePage = () => (
  <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: '#e2e8f0', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
    <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '15px' }}><Database size={36}/> Material Database & Costs</h1>
    <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '30px' }}>The static data source feeding the deterministic tradeoff engine and cost calculator.</p>
    
    <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: '#0f172a', color: '#38bdf8' }}>
          <tr>
            <th style={{ padding: '15px', borderBottom: '1px solid #334155' }}>Material</th>
            {/* UPDATED: Changed from USD to INR */}
            <th style={{ padding: '15px', borderBottom: '1px solid #334155' }}>Est. Cost (INR/m²)</th>
            <th style={{ padding: '15px', borderBottom: '1px solid #334155' }}>Strength</th>
            <th style={{ padding: '15px', borderBottom: '1px solid #334155' }}>Durability</th>
            <th style={{ padding: '15px', borderBottom: '1px solid #334155' }}>Best Use</th>
          </tr>
        </thead>
        <tbody>
          {/* UPDATED: Cost array values transformed to Indian Rupees (INR) */}
          {[
            { m: "AAC Blocks", p: "₹4,250", s: "Medium (2)", d: "High (3)", u: "Partition walls" },
            { m: "Red Brick", p: "₹5,200", s: "High (3)", d: "Medium (2)", u: "Load-bearing walls" },
            { m: "RCC", p: "₹11,350", s: "Very High (4)", d: "Very High (4)", u: "Columns, slabs" },
            { m: "Steel Frame", p: "₹14,190", s: "Very High (4)", d: "Very High (4)", u: "Long spans (>5m)" },
            { m: "Hollow Concrete", p: "₹3,780", s: "Medium (2)", d: "Medium (2)", u: "Non-structural" },
            { m: "Fly Ash Brick", p: "₹3,310", s: "Med-High (2.5)", d: "High (3)", u: "General walling" },
            { m: "Precast Panel", p: "₹8,510", s: "High (3)", d: "Very High (4)", u: "Structural, slabs" }
          ].map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#1e293b' : '#0f172a' }}>
              <td style={{ padding: '15px', borderBottom: '1px solid #334155', fontWeight: 'bold' }}>{row.m}</td>
              <td style={{ padding: '15px', borderBottom: '1px solid #334155', color: '#34d399', fontWeight: 'bold' }}>{row.p}</td>
              <td style={{ padding: '15px', borderBottom: '1px solid #334155', color: '#86efac' }}>{row.s}</td>
              <td style={{ padding: '15px', borderBottom: '1px solid #334155', color: '#93c5fd' }}>{row.d}</td>
              <td style={{ padding: '15px', borderBottom: '1px solid #334155', color: '#cbd5e1' }}>{row.u}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ==========================================
// PAGE 3: ABOUT
// ==========================================
const AboutPage = () => (
  <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: '#e2e8f0', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
    <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#3b82f6' }}>System Architecture</h1>
    <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '40px' }}>Addressing the 5 Mandatory Stages of the PS 2 Rubric.</p>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {[
        { step: "01", title: "Floor Plan Parsing", desc: "OpenCV extracts orthogonal geometry. Groq AI acts as a multimodal OCR agent to extract room names." },
        { step: "02", title: "Geometry Reconstruction", desc: "Shapely bounds classification determines Load-Bearing (outer perimeter) vs Partition (internal)." },
        { step: "03", title: "3D Model Generation", desc: "React Three Fiber dynamically extrudes lines to 3m heights and generates the slab." },
        { step: "04", title: "Tradeoff Logic & Cost Analysis", desc: "A deterministic algorithm ranks materials via weighted physics formulas, while a React module computes real-time cost estimations based on geometric surface area." },
        { step: "05", title: "Explainability", desc: "Groq AI translates the mathematical outputs into plain-language engineering justifications." }
      ].map(s => (
        <div key={s.step} style={{ display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '2rem', margin: 0 }}>{s.step}</h2>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{s.title}</h3>
            <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.5' }}>{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ==========================================
// NAVIGATION COMPONENT
// ==========================================
const Navbar = () => {
  const location = useLocation();
  const NavLink = ({ to, icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to} style={{ 
        display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', 
        padding: '8px 16px', borderRadius: '6px', fontWeight: '500', transition: 'all 0.2s',
        backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: isActive ? '#38bdf8' : '#cbd5e1'
      }}>
        {icon} {label}
      </Link>
    );
  };

  return (
    <nav style={{ height: '64px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>
        <Layers color="#3b82f6" /> AI/ML Track: Scan-to-BIM
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <NavLink to="/" icon={<Home size={18} />} label="Workspace" />
        <NavLink to="/database" icon={<Database size={18} />} label="Material DB" />
        <NavLink to="/about" icon={<Info size={18} />} label="Architecture" />
      </div>
    </nav>
  );
};

export default function App() {
  return (
    <Router>
      <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </div>
    </Router>
  );
}
