import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { generateCarouselStory, parseImportedScript, regenerateSlidesFromCaption, generateRewrite, generateTrivia, generateCarouselImage, generateSlideTextRewrite, generateSlidePrompt, editImageInpaint, generateDesignSuggestion } from './lib/gemini';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { CopyIcon, SparklesIcon, TrashIcon, Image as ImageIcon, Loader2, RefreshCw, Upload, Download, ArrowRight, ShareIcon, ChevronLeft, ChevronRight, Check, LogOutIcon, Settings as SettingsIcon, MousePointer2, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { cn, compressImage } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';
import TextareaAutosize from 'react-textarea-autosize';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';

function MascotLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="50" cy="90" rx="12" ry="3" fill="#80caca"/>
      <path d="M50 80C50 80 25 55 25 35C25 21.1929 36.1929 10 50 10C63.8071 10 75 21.1929 75 35C75 55 50 80 50 80Z" fill="#2EB1AD"/>
      <path d="M30 18 L18 10" stroke="#2EB1AD" strokeWidth="5" strokeLinecap="round"/>
      <path d="M14 15 L22 8" stroke="#2EB1AD" strokeWidth="5" strokeLinecap="round"/>
      <path d="M70 18 L82 10" stroke="#2EB1AD" strokeWidth="5" strokeLinecap="round"/>
      <path d="M86 15 L78 8" stroke="#2EB1AD" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="50" cy="35" r="18" fill="white"/>
      <circle cx="43" cy="30" r="2.5" fill="#5C3A21"/>
      <circle cx="57" cy="30" r="2.5" fill="#5C3A21"/>
      <path d="M38 36C38 42.6274 43.3726 48 50 48C56.6274 48 62 42.6274 62 36H38Z" fill="#F26522"/>
    </svg>
  );
}

const styleOptions = [
  { label: '📸 寫實攝影', value: 'Photorealistic, 8k resolution, cinematic lighting, highly detailed photography, editorial style' },
  { label: '📰 專業雜誌排版', value: 'Professional magazine editorial layout style background, clean space, high-end travel magazine vibe, empty space for text, ABSOLUTELY NO TEXT OR WORDS' },
  { label: '📊 資訊圖表', value: 'Modern minimal infographic background, clear visual elements, vector art, educational and informative layout, empty space for text, ABSOLUTELY NO TEXT OR WORDS' },
  { label: '🇯🇵 日系動漫 (Anime)', value: 'High quality Japanese anime style, Studio Ghibli style, vibrant colors, detailed background, cel shaded' },
  { label: '✨ 迪士尼 3D (Disney)', value: '3D animated movie style, Pixar style, Disney style, cute expressive characters, vibrant colors, ray tracing' },
  { label: '🎨 扁平插畫', value: 'Modern flat vector illustration style, vibrant colors' },
  { label: '🍜 美食特寫', value: 'Food photography, macro shot, studio lighting, appetizing, depth of field' },
  { label: '🖌️ 水彩暈染', value: 'Vintage watercolor painting, soft edges, aesthetic, dreamy' },
  { label: '🧸 3D 黏土', value: '3D claymation style, cute, tactile, highly detailed, vibrant' },
  { label: '🌃 復古底片', value: 'Vintage film photography, 35mm, light leaks, nostalgic vibe' }
];

const fontOptions = [
    { value: 'Inter', label: 'Inter (現代)' },
    { value: "'Noto Sans TC', sans-serif", label: 'Noto Sans TC (黑體)' },
    { value: "'Noto Serif TC', serif", label: 'Noto Serif TC (明體)' },
    { value: "'Oswald', sans-serif", label: 'Oswald (歐美標題)' },
    { value: "'Playfair Display', serif", label: 'Playfair (優雅)' },
    { value: "'Pacifico', cursive", label: 'Pacifico (圓潤手寫)' },
    { value: "'Dancing Script', cursive", label: 'Dancing Script (草書)' },
    { value: "'Anton', sans-serif", label: 'Anton (極粗)' },
    { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk (科技)' },
    { value: "'Outfit', sans-serif", label: 'Outfit (幾何)' }
];

const defaultData = {
  designSettings: {
    titleFontFamily: 'Inter',
    titleTextEffect: 'shadow',
    titleColor: '#f26522',
    titleSize: 80,
    bodyFontFamily: 'Inter',
    bodyTextEffect: 'shadow',
    bodyColor: '#ffffff',
    bodySize: 46,
    layoutStyle: 'gradient', // 'gradient', 'solid', 'glass', 'textOnly'
    layoutOpacity: 100
  },
  mainCaption: "請在上方輸入主題並選擇所需頁數（1-6頁），系統會為你準備專業詳盡的 IG 圖文企劃！\n\n#TraveltopiaHK #英國生活",
  slides: Array.from({ length: 6 }).map((_, i) => ({
    id: i + 1,
    imageText: `Slide ${i + 1}`,
    imageBody: `這裏是第${i + 1}張圖的詳細內文介紹。`,
    imagePrompt: "A beautiful landscape.",
    imagePromptZh: "美麗的風景。",
    textPosition: 'bottom',
    designSettings: {
      titleFontFamily: 'Inter',
      titleTextEffect: 'shadow',
      titleColor: '#f26522',
      titleSize: 80,
      bodyFontFamily: 'Inter',
      bodyTextEffect: 'shadow',
      bodyColor: '#ffffff',
      bodySize: 46,
      layoutStyle: 'gradient',
      layoutOpacity: 100
    }
  }))
};

const CtaSlideContent = ({ selectedCtaUrl }: { selectedCtaUrl?: string }) => {
    if (selectedCtaUrl) {
        return (
            <div className="w-full h-full bg-white relative overflow-hidden flex items-center justify-center">
                <img src={selectedCtaUrl} className="absolute inset-0 w-full h-full object-cover" />
            </div>
        );
    }
    return (
        <div className="w-full h-full bg-white relative flex flex-col justify-between overflow-hidden" style={{ containerType: 'inline-size' }}>
            <div className="absolute inset-0 m-[2.2cqw] border-[0.3cqw] border-[#b0b0b0] pointer-events-none z-10" />
            <div className="absolute inset-0 m-[3.7cqw] border-[0.2cqw] border-[#b0b0b0] pointer-events-none z-10" />

            <div className="flex-1 flex flex-col items-center justify-center relative z-20 pt-[7.4cqw]">
                <div className="flex items-center gap-[1.5cqw] mb-[2cqw]">
                    <h1 className="text-[6.6cqw] font-black text-black tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>Follow Us</h1>
                    <MousePointer2 className="w-[6cqw] h-[6cqw] text-neutral-500 fill-neutral-500 rotate-[-45deg] mb-[4.4cqw]" />
                </div>
                
                <div className="bg-[#8c8c8c] px-[4.4cqw] py-[1.5cqw] mb-[6cqw] shadow-sm">
                    <p className="text-[4.4cqw] font-bold text-white tracking-widest">traveltopia.hk</p>
                </div>

                <div className="flex flex-col items-center gap-[2.2cqw] mb-[8cqw]">
                    <h2 className="text-[5.5cqw] font-black text-black">發掘更多</h2>
                    <h2 className="text-[5.5cqw] font-black text-black">英國生活及旅遊資訊</h2>
                </div>

                <div className="flex items-center gap-[4.4cqw]">
                    <div className="flex flex-col items-center gap-[1cqw]">
                        <Heart className="w-[7.4cqw] h-[7.4cqw] text-neutral-600 fill-neutral-600" />
                        <span className="text-[2cqw] font-bold text-black tracking-wider uppercase">LIKE</span>
                    </div>
                    <div className="flex flex-col items-center gap-[1cqw]">
                        <MessageCircle className="w-[7.4cqw] h-[7.4cqw] text-neutral-600" strokeWidth={1.5} />
                        <span className="text-[2cqw] font-bold text-black tracking-wider uppercase">COMMENT</span>
                    </div>
                    <div className="flex flex-col items-center gap-[1cqw]">
                        <Send className="w-[7.4cqw] h-[7.4cqw] text-neutral-600" strokeWidth={1.5} />
                        <span className="text-[2cqw] font-bold text-black tracking-wider uppercase">SHARE</span>
                    </div>
                    <div className="flex flex-col items-center gap-[1cqw]">
                        <Bookmark className="w-[7.4cqw] h-[7.4cqw] text-neutral-600" strokeWidth={1.5} />
                        <span className="text-[2cqw] font-bold text-black tracking-wider uppercase">SAVE</span>
                    </div>
                </div>
            </div>

            <div className="h-[25%] bg-[#206A5D] w-full relative z-20 flex items-end justify-center pb-[4.4cqw]">
                <p className="text-[3.3cqw] font-bold text-white tracking-[0.5em]">旅遊邦</p>
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[45%]">
                    <MascotLogo className="w-[17.7cqw] h-[17.7cqw] drop-shadow-xl" />
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('☁️ 已連線');

  const [projectList, setProjectList] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  
  const [postData, setPostData] = useState(defaultData);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loadingSlide, setLoadingSlide] = useState<Record<string, boolean>>({});
  const [slideInstructions, setSlideInstructions] = useState<Record<string, string>>({});
  const [enlargedImage, setEnlargedImage] = useState<{url: string, slideIdx?: number} | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editImageLoading, setEditImageLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportFiles, setExportFiles] = useState<File[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Dynamic Google Fonts Loader
  useEffect(() => {
    if (!postData || !postData.slides) return;
    
    // Collect all unique font names used in global settings and custom slide overrides
    const fonts = new Set<string>();
    const ds = postData.designSettings || defaultData.designSettings;
    if (ds.fontFamily) fonts.add(ds.fontFamily);
    if (ds.titleFontFamily) fonts.add(ds.titleFontFamily);
    if (ds.bodyFontFamily) fonts.add(ds.bodyFontFamily);
    
    postData.slides.forEach(slide => {
      const sds = (slide as any).designSettings;
      if (sds) {
        if (sds.fontFamily) fonts.add(sds.fontFamily);
        if (sds.titleFontFamily) fonts.add(sds.titleFontFamily);
        if (sds.bodyFontFamily) fonts.add(sds.bodyFontFamily);
      }
    });
    
    // Fallbacks to load by default
    fonts.add('Inter');
    
    const cleanFontName = (font: string) => {
      return font.replace(/['"]/g, '').split(',')[0].trim();
    };

    const fontParamMap: Record<string, string> = {
      'Inter': 'Inter:wght@400;500;600;700;800;900',
      'Noto Sans TC': 'Noto+Sans+TC:wght@400;500;700;900',
      'Noto Serif TC': 'Noto+Serif+TC:wght@400;500;700;900',
      'Oswald': 'Oswald:wght@400;700',
      'Playfair Display': 'Playfair+Display:wght@400;700',
      'Pacifico': 'Pacifico',
      'Dancing Script': 'Dancing+Script:wght@400;700',
      'Anton': 'Anton',
      'Space Grotesk': 'Space+Grotesk:wght@400;700',
      'Outfit': 'Outfit:wght@400;700',
      'Zen Maru Gothic': 'Zen+Maru+Gothic:wght@400;500;700',
      'ZCOOL KuaiLe': 'ZCOOL+KuaiLe',
      'Ma Shan Zheng': 'Ma+Shan+Zheng',
      'Zhi Mang Xing': 'Zhi+Mang+Xing',
      'Montserrat': 'Montserrat:wght@400;700;900',
      'Poppins': 'Poppins:wght@400;700;900',
      'Bebas Neue': 'Bebas+Neue'
    };

    const cleanFonts = Array.from(fonts).map(cleanFontName);
    const params = cleanFonts
      .map(f => fontParamMap[f] || `${f.replace(/\s+/g, '+')}`)
      .map(p => `family=${p}`)
      .join('&');
    
    const url = `https://fonts.googleapis.com/css2?${params}&display=swap`;
    
    let link = document.getElementById('dynamic-google-fonts') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = 'dynamic-google-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    
    if (link.href !== url) {
      link.href = url;
    }
  }, [postData]);
  
  useEffect(() => { currentProjectIdRef.current = currentProjectId; }, [currentProjectId]);
  useEffect(() => { 
      if (!showExportPreview) {
          setExportFiles([]); 
          setIsSharing(false);
      }
  }, [showExportPreview]);


  
  const WrapperLayout = useCallback(({ children }: { children: React.ReactNode }) => {
    return isDesktop ? (
      <PanelGroup orientation="horizontal" className="w-full h-full lg:min-h-0 lg:flex-1 gap-1">
        {children}
      </PanelGroup>
    ) : (
      <div className="flex flex-col gap-5 w-full">
        {children}
      </div>
    );
  }, [isDesktop]);

  const WrapperLeft = useCallback(({ children }: { children: React.ReactNode }) => {
    return isDesktop ? (
      <Panel defaultSize={40} minSize={20} className="lg:!overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-5">{children}</div>
      </Panel>
    ) : (
      <div className="flex flex-col gap-5 w-full">{children}</div>
    );
  }, [isDesktop]);

  const WrapperRight = useCallback(({ children }: { children: React.ReactNode }) => {
    return isDesktop ? (
      <Panel defaultSize={60} minSize={20} className="lg:!overflow-y-auto pl-2 custom-scrollbar">
        <div className="flex flex-col gap-5">{children}</div>
      </Panel>
    ) : (
      <div className="flex flex-col gap-5 w-full">{children}</div>
    );
  }, [isDesktop]);

  // For drawing lines
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);


  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0].value);
  const [includeMascot, setIncludeMascot] = useState(true);
  const [useOriginalImage, setUseOriginalImage] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [slideCount, setSlideCount] = useState([6]);
  const [isLongContent, setIsLongContent] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const startDrawing = ({ nativeEvent }: any) => {
      const { offsetX, offsetY } = nativeEvent;
      if(ctxRef.current) {
          ctxRef.current.beginPath();
          ctxRef.current.moveTo(offsetX, offsetY);
          setIsDrawing(true);
      }
  };

  const draw = ({ nativeEvent }: any) => {
      if (!isDrawing) return;
      const { offsetX, offsetY } = nativeEvent;
      if(ctxRef.current) {
          ctxRef.current.lineTo(offsetX, offsetY);
          ctxRef.current.stroke();
      }
  };

  const stopDrawing = () => {
      if(ctxRef.current) {
          ctxRef.current.closePath();
      }
      setIsDrawing(false);
  };

  const initCanvas = (imgEl: HTMLImageElement) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = imgEl.width;
      canvas.height = imgEl.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "rgba(255, 0, 0, 0.6)"; // Red, semi-transparent
          ctx.lineWidth = 15;
          ctxRef.current = ctx;
      }
  };
  
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [importedScript, setImportedScript] = useState('');
  const [isParsingScript, setIsParsingScript] = useState(false);
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);
  const [isGeneratingTrivia, setIsGeneratingTrivia] = useState(false);
  const [isGeneratingSlideText, setIsGeneratingSlideText] = useState(false);
  const [isGeneratingSlidePrompt, setIsGeneratingSlidePrompt] = useState(false);
  const [loadingDesignSuggestion, setLoadingDesignSuggestion] = useState<{[key: number]: boolean}>({});
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [rewriteOptions, setRewriteOptions] = useState<string[]>([]);
  const [triviaList, setTriviaList] = useState<string[]>([]);

  const [brandLibrary, setBrandLibrary] = useState<any[]>([]);
  const [selectedMascotId, setSelectedMascotId] = useState<string | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const selectedCtaUrl = brandLibrary.find(item => item.id === (postData as any).selectedCtaId && item.category === 'CTA')?.dataUrl;

  const [copyStatus, setCopyStatus] = useState('');

  // Auto-save postData to prevent data loss on immediate reload
  useEffect(() => {
    if (!currentProjectId || !user || !postData) return;
    const timer = setTimeout(() => {
      saveProjectData(postData, true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [postData, currentProjectId]);

  // Setup Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
          setCurrentProjectId(null);
          currentProjectIdRef.current = null;
          setProjectList([]);
          setImages({});
          setPostData({ slides: [], mainCaption: '', originalCaption: '', title: '' });
      }
      setAuthLoading(false);
    });
    const key = localStorage.getItem('gemini_api_key');
    if (key) setApiKeyInput(key);
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Login error', e);
      alert('Login error: ' + (e as Error).message);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Prefs
    const prefsRef = doc(db, 'users', user.uid, 'preferences', 'default');
    const unsubPrefs = onSnapshot(prefsRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.selectedStyle) setSelectedStyle(d.selectedStyle);
        if (d.includeMascot !== undefined) setIncludeMascot(d.includeMascot);
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'users/*/preferences'));

    // Projects
    const projRef = collection(db, 'users', user.uid, 'projects');
    const unsubProj = onSnapshot(projRef, (snap) => {
      const projs: any[] = [];
      snap.forEach(d => projs.push({ id: d.id, ...d.data() }));
      projs.sort((a, b) => b.updatedAt - a.updatedAt);
      setProjectList(projs);
      
      if (projs.length > 0 && !currentProjectIdRef.current) {
         loadProject(projs[0].id, projs[0]);
      } else if (projs.length === 0 && !currentProjectIdRef.current) {
         // Create default
         createNewProject();
      }
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'users/*/projects'));

    // Brand Library
    const libRef = collection(db, 'brandLibrary');
    const unsubLib = onSnapshot(libRef, snap => {
      const libs: any[] = [];
      snap.forEach(d => libs.push({ id: d.id, ...d.data() }));
      libs.sort((a, b) => b.createdAt - a.createdAt);
      setBrandLibrary(libs);
    }, e => handleFirestoreError(e, OperationType.LIST, 'brandLibrary'));

    return () => { unsubPrefs(); unsubProj(); unsubLib(); };
  }, [user]);

  const deleteProject = async () => {
    if (!user || !currentProjectId) return;
    setSyncStatus('🗑️ 刪除中...');
    try {
        const idToDelete = currentProjectId;
        await deleteDoc(doc(db, 'users', user.uid, 'projects', idToDelete));
        setSyncStatus('☁️ 已刪除');
        
        const remaining = projectList.filter(p => p.id !== idToDelete);
        if (remaining.length > 0) {
            loadProject(remaining[0].id, remaining[0]);
        } else {
            createNewProject();
        }
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, 'users/*/projects'); }
  };

  const createNewProject = async () => {
    if (!user) return;
    setSyncStatus('💾 建立中...');
    const newId = `proj_${Date.now()}`;
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    const newProj = { name: formattedDate, postData: defaultData, updatedAt: Date.now() };
    try {
        await setDoc(doc(db, 'users', user.uid, 'projects', newId), newProj);
        setSyncStatus('☁️ 已儲存');
        setCurrentProjectId(newId);
        setPostData(defaultData);
        setImages({});
        setCurrentSlide(0);
    } catch(e) { handleFirestoreError(e, OperationType.CREATE, 'users/*/projects'); }
  };

  const loadProject = async (id: string, metadata: any) => {
    if (!user) return;
    setSyncStatus('🔄 載入中...');
    setCurrentProjectId(id);
    
    // Backwards compatibility for old projects
    let parsedData = metadata.postData || defaultData;
    if (!parsedData.designSettings) {
        parsedData = { ...parsedData, designSettings: defaultData.designSettings };
    }
    setPostData(parsedData);
    
    setKeyword('');
    setSlideCount([metadata.postData.slides?.length || 6]);
    setCurrentSlide(0);
    setRewriteOptions([]);
    setTriviaList([]);
    setSelectedMascotId(null);
    setSelectedLayoutId(null);
    setImages({});
    
    // Load Images
    for (let i = 1; i <= (metadata.postData.slides?.length || 6); i++) {
       const imgRef = doc(db, 'users', user.uid, 'images', `${id}_${i}`);
       try {
           const snap = await getDoc(imgRef);
           if (snap.exists()) setImages(prev => ({ ...prev, [i]: snap.data().dataUrl }));
       } catch (e) { console.error('Image load optional fail', e) }
    }
    setSyncStatus('☁️ 已聯網');
  };

  const updateProjectName = async (newName: string) => {
    if (!user || !currentProjectId) return;
    const p = projectList.find(x => x.id === currentProjectId);
    if (p && p.name !== newName) {
        const pList = [...projectList];
        const target = pList.find(x => x.id === currentProjectId);
        if (target) target.name = newName;
        setProjectList(pList);
    }
    
    // Always save to Firestore if called, since this is for persistence
    try {
        await setDoc(doc(db, 'users', user.uid, 'projects', currentProjectId), {
            name: newName,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'users/*/projects'); }
  };


  const saveProjectData = async (newData: any, disableStatusUpdate?: boolean) => {
    if (!user || !currentProjectId) return;
    if (!disableStatusUpdate) setSyncStatus('💾 儲存中...');
    const proj = projectList.find(p => p.id === currentProjectId);
    try {
        await setDoc(doc(db, 'users', user.uid, 'projects', currentProjectId), {
            name: proj?.name || '專案',
            postData: newData,
            updatedAt: Date.now()
        }, { merge: true });
        if (!disableStatusUpdate) setSyncStatus('☁️ 已聯網');
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'users/*/projects'); }
  };

  const saveProjectImage = async (slideId: number | string, dataUrl: string) => {
    if (!user || !currentProjectId) return;
    try {
        const compressedDataUrl = await compressImage(dataUrl, 1080, 0.6); // Lower quality to 0.6 to reduce file size
        await setDoc(doc(db, 'users', user.uid, 'images', `${currentProjectId}_${slideId}`), { dataUrl: compressedDataUrl });
    } catch(e) { handleFirestoreError(e, OperationType.CREATE, 'users/*/images'); }
  };

  const savePrefs = (updates: any) => {
    if (!user) return;
    try { setDoc(doc(db, 'users', user.uid, 'preferences', 'default'), updates, { merge: true }); }
    catch(e) {}
  };

  const handleUploadToLibrary = async (e: React.ChangeEvent<HTMLInputElement>, category: 'TT' | 'Layout' | 'CTA') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
       try {
           const docRef = await addDoc(collection(db, 'brandLibrary'), {
               category,
               dataUrl: reader.result,
               createdAt: Date.now(),
               uploaderId: user.uid
           });
           if (category === 'CTA') {
               const newData = { ...postData, selectedCtaId: docRef.id };
               setPostData(newData);
               saveProjectData(newData, true);
           }
       } catch (error) {
           handleFirestoreError(error, OperationType.CREATE, 'brandLibrary');
       }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLibrary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
       await deleteDoc(doc(db, 'brandLibrary', id));
       if (selectedMascotId === id) setSelectedMascotId(null);
       if (selectedLayoutId === id) setSelectedLayoutId(null);
       if ((postData as any).selectedCtaId === id) {
           const newData = { ...postData, selectedCtaId: undefined };
           setPostData(newData);
           saveProjectData(newData, true);
       }
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, 'brandLibrary');
    }
  };

  const handleEditImageSubmit = async () => {
    if (!enlargedImage || !canvasRef.current || !editPrompt) return;
    
    setEditImageLoading(true);
    try {
        const imgEl = new Image();
        imgEl.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
            imgEl.onload = resolve;
            imgEl.onerror = () => {
               // Fallback if crossOrigin fails
               console.log("crossOrigin image load failed, retrying without");
               const fallbackImg = new Image();
               fallbackImg.onload = resolve;
               fallbackImg.onerror = reject;
               fallbackImg.src = enlargedImage.url;
            };
            imgEl.src = enlargedImage.url;
        });

        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = imgEl.width;
        targetCanvas.height = imgEl.height;
        const tCtx = targetCanvas.getContext('2d');
        if(!tCtx) return;
        
        tCtx.drawImage(imgEl, 0, 0);
        tCtx.drawImage(canvasRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height, 0, 0, targetCanvas.width, targetCanvas.height);
        
        const composedBase64 = targetCanvas.toDataURL('image/jpeg', 0.8);
        
        const resUrl = await editImageInpaint(composedBase64, editPrompt);
        
        if (enlargedImage.slideIdx !== undefined) {
             const slideId = postData.slides[enlargedImage.slideIdx].id;
             setImages(prev => ({ ...prev, [slideId]: resUrl }));
        }
        setEnlargedImage({ ...enlargedImage, url: resUrl });
        setIsEditingImage(false);
        setEditPrompt("");
        
        if(ctxRef.current && canvasRef.current) {
            ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    } catch(e) {
        console.error(e);
        alert("Failed to edit image. " + (e as any).message);
    } finally {
        setEditImageLoading(false);
    }
  };

  const handleGenerateStory = async () => {
    if (!keyword) return;
    setIsGeneratingStory(true);
    try {
        const payload = await generateCarouselStory(keyword, slideCount[0], isLongContent, language);
        payload.designSettings = { ...(postData.designSettings || defaultData.designSettings) };
        payload.slides = payload.slides.map((s: any) => ({
            ...s,
            textPosition: 'bottom',
            designSettings: { ...payload.designSettings }
        }));
        setPostData(payload);
        setCurrentSlide(0);
        setImages({});
        await saveProjectData(payload);
        showCopyStatus('✅ 已成功生成內容！');
    } catch (e) { console.error(e); showCopyStatus('⚠️ 生成失敗請重試'); }
    setIsGeneratingStory(false);
  };

  const handleImportScript = async () => {
    if (!importedScript.trim()) return;
    setIsParsingScript(true);
    try {
        const payload = await parseImportedScript(importedScript, language);
        payload.designSettings = { ...(postData.designSettings || defaultData.designSettings) };
        payload.slides = payload.slides.map((s: any) => ({
            ...s,
            textPosition: 'bottom',
            designSettings: { ...payload.designSettings }
        }));
        setPostData(payload);
        setCurrentSlide(0);
        setImages({});
        setSlideInstructions({});
        await saveProjectData(payload);
        showCopyStatus('✅ 已成功解析並匯入腳本內容！');
    } catch (e) {
        console.error(e);
        showCopyStatus('⚠️ 解析失敗請重試');
    }
    setIsParsingScript(false);
  };

  const handlePlanSlidesFromCaption = async () => {
    if (!postData.mainCaption) return;
    setIsGeneratingStory(true);
    try {
        const slides = await regenerateSlidesFromCaption(postData.mainCaption, slideCount[0], language);
        const mappedSlides = slides.map((s: any) => ({
            ...s,
            textPosition: 'bottom',
            designSettings: { ...(postData.designSettings || defaultData.designSettings) }
        }));
        const newPostData = { ...postData, slides: mappedSlides };
        setPostData(newPostData);
        setCurrentSlide(0);
        await saveProjectData(newPostData);
        showCopyStatus('✅ 已成功規劃分頁內容！');
    } catch (e) { console.error(e); showCopyStatus('⚠️ 生成失敗請重試'); }
    setIsGeneratingStory(false);
  };

  const showCopyStatus = (msg: string) => {
      setCopyStatus(msg);
      setTimeout(() => setCopyStatus(''), 3000);
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(postData.mainCaption).then(() => showCopyStatus('✅ 內容已複製！'));
  };

  const handleGenerateImage = async (slideIndex: number) => {
    const slide = postData.slides[slideIndex];
    setLoadingSlide(prev => ({...prev, [slide.id]: true}));
    
    const instr = slideInstructions[slide.id] || '';
    let mascotImg = selectedMascotId ? brandLibrary.find(b => b.id === selectedMascotId) : undefined;
    let layoutImg = selectedLayoutId ? brandLibrary.find(b => b.id === selectedLayoutId) : undefined;
    
    if (mascotImg && !includeMascot) {
        mascotImg = undefined;
    }
    
    try {
        let b64 = '';
        if (useOriginalImage && (layoutImg || mascotImg)) {
            b64 = (layoutImg || mascotImg).dataUrl;
        } else {
            b64 = await generateCarouselImage(slide.imagePrompt, selectedStyle, instr, undefined, includeMascot, mascotImg, layoutImg);
        }
        setImages(prev => ({ ...prev, [slide.id]: b64 }));
        saveProjectImage(slide.id, b64).catch(e => console.error("Background save failed:", e));
    } catch (e) {
        console.error(e);
        showCopyStatus('⚠️ 圖片生成失敗，嘗試更換參考圖或重試');
    }
    setLoadingSlide(prev => ({...prev, [slide.id]: false}));
  };

  const handleGenerateAllImages = async () => {
      setIsGeneratingAllImages(true);
      try {
          const promises = [];
          for (let i = 0; i < postData.slides.length; i++) {
              const slide = postData.slides[i];
              if (!images[slide.id] && slide.imagePrompt) {
                  promises.push(handleGenerateImage(i));
              }
          }
          if (promises.length === 0) {
              showCopyStatus('ℹ️ 沒有需要生成的缺圖！');
          } else {
              await Promise.all(promises);
              showCopyStatus('✅ 批量生成完成！');
          }
      } finally {
          setIsGeneratingAllImages(false);
      }
  };

  const exportToIG = async () => {
    setIsExporting(true);
    try {
        showCopyStatus('📸 準備匯出中...');
        
        // 1. Wait for dynamic fonts to be fully loaded and give Safari time to paint
        try {
            await document.fonts.ready;
        } catch (e) {
            console.warn('Font loading check failed:', e);
        }
        await new Promise(r => setTimeout(r, 150));
        // 2. Copy caption to clipboard
        try {
            await navigator.clipboard.writeText(postData.mainCaption);
            showCopyStatus('📝 內文已複製！正在準備圖片...');
        } catch (err) {
            console.error('Clipboard copy failed', err);
        }

        const files: File[] = [];
        let readyCount = 0;
        
        for (let idx = 0; idx < postData.slides.length; idx++) {
            const slide = postData.slides[idx];
            if (images[slide.id]) {
                const el = document.getElementById(`export-slide-${idx}`);
                if (el) {
                    try {
                        // Pass 1: Warm up Safari's image decoder cache (fixes first-time blank images)
                        await htmlToImage.toJpeg(el, { quality: 0.1, canvasWidth: 1080, canvasHeight: 1350, skipFonts: true });
                        // Pass 2: The actual high-quality capture
                        const dataUrl = await htmlToImage.toJpeg(el, { 
                            quality: 0.8, // Reduced from 1 to 0.8
                            canvasWidth: 1080, 
                            canvasHeight: 1350,
                            pixelRatio: 1, // Reduced from 2 to 1 for smaller file size
                            skipFonts: false,
                            cacheBust: true
                        });
                        
                        // Convert dataUrl to File for sharing
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        const file = new File([blob], `traveltopia_slide_${idx+1}.jpg`, { type: 'image/jpeg' });
                        files.push(file);
                        readyCount++;
                    } catch(e) { console.error('Export error', e) }
                }
            }
        }

        if (postData.includeCta !== false) {
            const el = document.getElementById('export-slide-cta');
            if (el) {
                try {
                    await htmlToImage.toJpeg(el, { quality: 0.1, canvasWidth: 1080, canvasHeight: 1350, skipFonts: true });
                    const dataUrl = await htmlToImage.toJpeg(el, { 
                        quality: 0.8, 
                        canvasWidth: 1080, 
                        canvasHeight: 1350,
                        pixelRatio: 1, 
                        skipFonts: false,
                        cacheBust: true
                    });
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `traveltopia_slide_${postData.slides.length + 1}.jpg`, { type: 'image/jpeg' });
                    files.push(file);
                } catch(e) { console.error('Export CTA error', e) }
            }
        }

        return files;
    } finally {
        setIsExporting(false);
    }
  };

  // Text Styling Helpers
  const getTextStyle = (isTitle: boolean, slideIndex?: number) => {
    let ds = postData.designSettings || defaultData.designSettings;
    
    if (slideIndex !== undefined && (postData.slides[slideIndex] as any).designSettings) {
        ds = { ...ds, ...(postData.slides[slideIndex] as any).designSettings };
    }

    const baseSize = isTitle ? ds.titleSize : ds.bodySize;
    const computedSize = `${(baseSize / 1080) * 100}cqw`;

    const color = isTitle ? ds.titleColor : ds.bodyColor;
    let textShadow = 'none';
    const effect = isTitle ? (ds.titleTextEffect || ds.textEffect || 'shadow') : (ds.bodyTextEffect || ds.textEffect || 'shadow');
    let WebkitTextStroke = undefined;
    
    if (effect === 'shadow') {
       textShadow = '0cqw 0.185cqw 0.926cqw rgba(0,0,0,0.5)';
    } else if (effect === 'neon') {
       textShadow = `0cqw 0cqw 0.463cqw ${color}, 0cqw 0cqw 0.926cqw ${color}, 0cqw 0cqw 1.852cqw ${color}`;
    } else if (effect === 'outline') {
       WebkitTextStroke = '0.1389cqw black';
    }

    return {
        fontFamily: isTitle ? (ds.titleFontFamily || ds.fontFamily || 'Inter') : (ds.bodyFontFamily || ds.fontFamily || 'Inter'),
        color: color,
        fontSize: computedSize,
        textShadow,
        WebkitTextStroke
    };
  };

  const getLayoutPaddingStyle = (position: 'top' | 'bottom', slideIndex?: number) => {
      let ds = postData.designSettings || defaultData.designSettings;
      if (slideIndex !== undefined && (postData.slides[slideIndex] as any).designSettings) {
          ds = { ...ds, ...(postData.slides[slideIndex] as any).designSettings };
      }
      
      const isTop = position === 'top';
      const isGradient = !ds.layoutStyle || ds.layoutStyle === 'gradient';
      
      const basePad = '7.407cqw';
      const extendedPad = '22.22cqw';
      
      if (isGradient) {
          return {
              paddingLeft: basePad,
              paddingRight: basePad,
              paddingBottom: isTop ? extendedPad : basePad,
              paddingTop: isTop ? basePad : extendedPad
          };
      } else {
          return {
              paddingTop: basePad,
              paddingRight: basePad,
              paddingBottom: basePad,
              paddingLeft: basePad,
          };
      }
  };

  const getOuterLayoutBgClass = (position: 'top' | 'bottom', slideIndex?: number) => {
      let ds = postData.designSettings || defaultData.designSettings;
      if (slideIndex !== undefined && (postData.slides[slideIndex] as any).designSettings) {
          ds = { ...ds, ...(postData.slides[slideIndex] as any).designSettings };
      }
      
      const isTop = position === 'top';
      const opacity = ds.layoutOpacity ?? 100;
      const positionClass = isTop ? 'top-0 flex flex-col justify-start items-start' : 'bottom-0 flex flex-col justify-end items-start';

      if (opacity === 0 || ds.layoutStyle === 'textOnly' || ds.layoutStyle === 'solid' || ds.layoutStyle === 'glass') {
          return positionClass;
      }

      let bgClass = "";
      if (opacity === 100) bgClass = 'bg-gradient-to-b from-black/90 via-black/50 to-transparent';
      else if (opacity === 75) bgClass = 'bg-gradient-to-b from-black/70 via-black/40 to-transparent';
      else if (opacity === 50) bgClass = 'bg-gradient-to-b from-black/50 via-black/25 to-transparent';
      else if (opacity === 25) bgClass = 'bg-gradient-to-b from-black/25 via-black/10 to-transparent';
      
      if (!isTop && bgClass) bgClass = bgClass.replace('bg-gradient-to-b', 'bg-gradient-to-t');

      return `${positionClass} ${bgClass}`;
  };

  const getInnerLayoutBgClass = (slideIndex?: number) => {
      let ds = postData.designSettings || defaultData.designSettings;
      if (slideIndex !== undefined && (postData.slides[slideIndex] as any).designSettings) {
          ds = { ...ds, ...(postData.slides[slideIndex] as any).designSettings };
      }
      
      const opacity = ds.layoutOpacity ?? 100;

      if (opacity === 0 || ds.layoutStyle === 'textOnly' || ds.layoutStyle === 'gradient' || !ds.layoutStyle) {
          return "w-full";
      }

      let bgClass = "w-fit max-w-full rounded-[4cqw] p-[5cqw] ";
      switch (ds.layoutStyle) {
          case 'solid':
              if (opacity === 100) bgClass += 'bg-black/90 shadow-xl';
              else if (opacity === 75) bgClass += 'bg-black/75 shadow-lg';
              else if (opacity === 50) bgClass += 'bg-black/50 shadow-md';
              else if (opacity === 25) bgClass += 'bg-black/25 shadow-sm';
              break;
          case 'glass':
              if (opacity === 100) bgClass += 'bg-white/30 backdrop-blur-xl border border-white/40 shadow-xl';
              else if (opacity === 75) bgClass += 'bg-white/20 backdrop-blur-md border border-white/30 shadow-lg';
              else if (opacity === 50) bgClass += 'bg-white/10 backdrop-blur-sm border border-white/20 shadow-md';
              else if (opacity === 25) bgClass += 'bg-white/5 backdrop-blur-sm border border-white/10 shadow-sm';
              break;
      }
      return bgClass;
  };

  // Rendering
  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-[#2EB1AD] font-bold bg-[#F7F6F3]"><Loader2 className="animate-spin w-6 h-6 mr-2" />系統載入中...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex flex-col items-center justify-center p-6 text-[#2D3142]">
        <MascotLogo className="w-20 h-20 mb-6 drop-shadow-md" />
        <h1 className="text-3xl font-black mb-2 text-[#2EB1AD]">Traveltopia Creator</h1>
        <p className="text-[#64748B] mb-8 max-w-sm text-center font-bold">開始策劃您的下一趟旅程，自動生成專業 IG 貼文與視覺內容。</p>
        <button onClick={handleLogin} className="px-6 py-3.5 bg-[#F26522] text-white rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-[#D9531E] transition">
          使用 Google 帳號登入
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#2D3142] font-sans p-4 md:p-6 flex flex-col gap-5">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-[#E5E7EB] px-6 py-4 rounded-3xl shadow-sm z-40 lg:sticky lg:top-4">
        <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
                <MascotLogo className="w-12 h-12 shrink-0 drop-shadow-sm" />
                <h1 className="text-2xl font-black tracking-tight text-[#f26522]">Traveltopia <span className="font-bold text-[#2eb1ad] ml-1 hidden sm:inline">Creator</span></h1>
            </div>
            
            {/* User email shown on mobile as well optionally, but let's put it on the right side on desktop */}
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
            {user && (
                <div className="flex items-center gap-2 mr-2 text-xs font-bold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-full border border-neutral-200">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {user.email}
                    <button onClick={() => signOut(auth)} className="ml-2 hover:text-[#f26522] transition-colors" title="登出"><LogOutIcon className="w-3.5 h-3.5" /></button>
                </div>
            )}
            
            <input 
                type="text" 
                value={projectList.find(p => p.id === currentProjectId)?.name || ''}
                onChange={e => {
                    const newName = e.target.value;
                    const pList = [...projectList];
                    const p = pList.find(x => x.id === currentProjectId);
                    if (p) { p.name = newName; setProjectList(pList); }
                }}
                onBlur={e => updateProjectName(e.target.value)}
                placeholder="專案名稱"
                className="w-[180px] h-10 px-3 text-sm font-bold bg-transparent border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#f26522]/50 outline-none transition-all shadow-inner focus:bg-white"
            />

            <Select value={currentProjectId || ''} onValueChange={val => {
                const p = projectList.find(x => x.id === val);
                if (p) loadProject(p.id, p);
            }}>
                <SelectTrigger className="w-[150px] h-10 text-xs font-bold border border-[#E5E7EB] bg-[#F7F6F3] rounded-xl focus:ring-[#f26522]/50">
                    <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                    {projectList.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name || 'Unnamed'}</SelectItem>)}
                </SelectContent>
            </Select>
            <button 
              className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl border border-red-100 transition-colors shadow-sm" 
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              title="刪除目前專案"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button 
              className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 hover:text-black rounded-xl border border-gray-200 transition-colors shadow-sm" 
              onClick={() => setShowSettings(true)}
              title="設定 (API Key)"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            {showDeleteConfirm && (
                <div className="absolute top-[80px] right-6 bg-white border border-red-100 p-3 rounded-xl shadow-xl flex items-center gap-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <span className="text-xs font-bold text-red-600 whitespace-nowrap">確定刪除此專案？</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors" onClick={() => { setShowDeleteConfirm(false); deleteProject(); }}>
                            確定
                        </button>
                        <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors" onClick={() => setShowDeleteConfirm(false)}>
                            取消
                        </button>
                    </div>
                </div>
            )}
            <button className="px-5 py-2.5 bg-gray-400 text-white hover:bg-gray-500 rounded-xl border border-transparent text-sm font-black whitespace-nowrap transition-colors shadow-sm active:translate-y-0.5" onClick={createNewProject}>
              ➕ <span className="hidden sm:inline">新專案</span>
            </button>
            <button onClick={() => setShowExportPreview(true)} className="hidden md:inline-flex px-5 py-2.5 bg-gray-400 text-white hover:bg-gray-500 rounded-xl border border-transparent text-sm font-bold whitespace-nowrap transition-colors shadow-sm active:translate-y-0.5">
              📸 <span className="hidden xl:inline ml-1">匯出全部 (已複製內文)</span><span className="inline xl:hidden ml-1">匯出</span>
            </button>
        </div>
      </header>

      {/* Bento Grid Main Layout */}
      <main className="flex-1 min-h-[0px] w-full flex flex-col pt-1">
        <WrapperLayout>
        {/* Left Column (Inputs) */}
        <WrapperLeft>
            
            {/* Box 1: Configuration */}
            <section className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-6 bg-[#2EB1AD] rounded-full"></div>
                    <h2 className="font-black text-[#2D3142] text-lg">企劃設定</h2>
                  </div>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-2 block">語言設定 (Language)</label>
                        <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                            <SelectTrigger className="w-full bg-[#F7F6F3] border focus:border-[#2eb1ad] rounded-xl px-4 py-3 text-sm font-bold focus-visible:ring-[#2eb1ad]">
                                <SelectValue placeholder="選擇語言" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="zh" className="font-bold">繁體中文</SelectItem>
                                <SelectItem value="en" className="font-bold">English (UK)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs defaultValue="keyword" className="w-full space-y-4">
                        <TabsList className="grid grid-cols-2 bg-[#F7F6F3] p-1 rounded-xl w-full h-11 border border-[#EAE8E4]">
                            <TabsTrigger value="keyword" className="font-bold py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-active:bg-white data-active:shadow-sm">
                                話題生成
                            </TabsTrigger>
                            <TabsTrigger value="import" className="font-bold py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-active:bg-white data-active:shadow-sm">
                                匯入腳本
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="keyword" className="space-y-4 outline-none">
                            <div>
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-2 block">話題關鍵字</label>
                                <Input placeholder="例如：倫敦深度一日遊..." value={keyword} onChange={e => setKeyword(e.target.value)} className="w-full bg-[#F7F6F3] border focus:border-[#2eb1ad] rounded-xl px-4 py-3 text-sm font-bold focus-visible:ring-[#2eb1ad]" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">貼文頁數</label>
                                    <span className="text-[#f26522] font-black text-sm bg-[#FFF3E0] px-3 py-1 rounded-lg">{slideCount[0]} 頁</span>
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                    {[1,2,3,4,5,6].map(num => (
                                       <button 
                                          key={num}
                                          onClick={() => setSlideCount([num])}
                                          className={cn("py-2.5 rounded-xl text-sm font-black transition-all border", 
                                            slideCount[0] === num 
                                              ? "bg-[#2EB1AD] text-white border-transparent shadow-sm scale-105" 
                                              : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                                          )}
                                       >
                                         {num}
                                       </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">內容長度 (Threads 友好 vs 深度企劃)</label>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsLongContent(false)}
                                        className={cn("flex-1 py-2.5 rounded-xl text-xs font-black transition-all border", 
                                          !isLongContent 
                                            ? "bg-[#2EB1AD] text-white border-transparent shadow-sm scale-105" 
                                            : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                                        )}
                                    >
                                        🧵 簡潔 (500字內)
                                    </button>
                                    <button 
                                        onClick={() => setIsLongContent(true)}
                                        className={cn("flex-1 py-2.5 rounded-xl text-xs font-black transition-all border", 
                                          isLongContent 
                                            ? "bg-[#2EB1AD] text-white border-transparent shadow-sm scale-105" 
                                            : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                                        )}
                                    >
                                        📖 專業深度
                                    </button>
                                </div>
                            </div>
                            <button onClick={handleGenerateStory} disabled={isGeneratingStory || !keyword} className="w-full py-3.5 bg-zinc-900 text-white rounded-xl text-sm font-bold mt-2 hover:bg-zinc-800 hover:-translate-y-0.5 shadow-sm active:translate-y-0.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all flex justify-center items-center">
                                {isGeneratingStory ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                                生成內容草稿
                            </button>
                        </TabsContent>
                        
                        <TabsContent value="import" className="space-y-4 outline-none">
                            <div>
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-2 block">貼上你的腳本或草稿</label>
                                <Textarea 
                                    placeholder="貼上你的文章、分頁大綱、筆記或完整草稿..." 
                                    value={importedScript} 
                                    onChange={e => setImportedScript(e.target.value)} 
                                    className="w-full min-h-[140px] bg-[#F7F6F3] border focus:border-[#2eb1ad] rounded-xl px-4 py-3 text-sm font-medium focus-visible:ring-[#2eb1ad] resize-y" 
                                />
                                <span className="text-[10px] text-neutral-400 mt-1 block">AI 將自動判斷分頁數量、翻譯並生成符合設計規範的英文 Image Prompt。</span>
                            </div>
                            
                            <button onClick={handleImportScript} disabled={isParsingScript || !importedScript.trim()} className="w-full py-3.5 bg-zinc-900 text-white rounded-xl text-sm font-bold mt-2 hover:bg-zinc-800 hover:-translate-y-0.5 shadow-sm active:translate-y-0.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all flex justify-center items-center">
                                {isParsingScript ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                                智能解析並匯入
                            </button>
                        </TabsContent>
                    </Tabs>
                </div>
            </section>

            {/* Box 2: Editing & Polishing */}
            <section className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col gap-4 flex-1">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-6 bg-[#f26522] rounded-full"></div>
                        <h2 className="font-black text-[#2D3142] text-lg">內文編排</h2>
                    </div>
                    <button onClick={handleCopyCaption} className="text-xs font-black text-[#2D3142] bg-white border border-[#E5E7EB] hover:bg-[#F7F6F3] px-3 py-1.5 rounded-xl uppercase transition flex items-center shadow-sm hover:-translate-y-0.5 active:translate-y-0">
                        <CopyIcon className="w-3.5 h-3.5 mr-1" /> 複製
                    </button>
                </div>
                
                <div className="flex flex-col gap-3 h-full">
                    <div className="grid grid-cols-2 gap-3">
          <button 
            disabled={isGeneratingRewrite || !postData.mainCaption} 
            onClick={async () => {
              setIsGeneratingRewrite(true);
              try {
                setRewriteOptions(await generateRewrite(postData.mainCaption, language));
              } catch(e) { }
              setIsGeneratingRewrite(false);
            }}
            className="px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-200 text-zinc-900 transition disabled:opacity-50 shadow-sm"
          >
            {isGeneratingRewrite ? '正在以雜誌風格改寫...' : '✍️ 雜誌風格改寫'}
          </button>
                        <button 
                            disabled={isGeneratingTrivia || !postData.mainCaption}
                            onClick={async () => {
                                setIsGeneratingTrivia(true);
                                try {
                                    setTriviaList(await generateTrivia(keyword || "英國旅行", language));
                                } catch(e) { }
                                setIsGeneratingTrivia(false);
                            }}
                            className="px-4 py-2 bg-[#F7F6F3] border border-[#E5E7EB] rounded-xl text-xs font-black hover:border-[#2EB1AD] hover:text-[#2EB1AD] text-neutral-500 transition disabled:opacity-50"
                        >
                            {isGeneratingTrivia ? '搜尋中...' : '補充冷知識'}
                        </button>
                    </div>

                    <button 
                        disabled={isGeneratingStory || !postData.mainCaption}
                        onClick={handlePlanSlidesFromCaption}
                        className="w-full py-2.5 bg-[#2EB1AD] text-white rounded-xl text-sm font-bold hover:bg-[#259B97] transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                    >
                        {isGeneratingStory ? <Loader2 className="animate-spin w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                        ✨ 根據內文自動規劃所有分頁 (圖片提示與文案)
                    </button>

                    <AnimatePresence>
                        {rewriteOptions.length > 0 && (
                            <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="flex flex-col gap-2 p-3 bg-[#FFF3E0] rounded-xl border border-[#FF9F1C]">
                                <span className="text-[10px] uppercase font-black text-[#f26522]">點擊套用改寫：</span>
                                {rewriteOptions.map((v, i) => (
                                    <div key={i} onClick={() => { setPostData({...postData, mainCaption: v}); setRewriteOptions([]); saveProjectData({...postData, mainCaption: v}); }} className="p-3 bg-white rounded-lg text-xs leading-relaxed font-bold text-[#2D3142] cursor-pointer hover:border-[#FF9F1C] border border-transparent shadow-sm">{v}</div>
                                ))}
                            </motion.div>
                        )}
                        {triviaList.length > 0 && (
                            <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="flex flex-col gap-2 p-3 bg-[#E0F7FA] rounded-xl border border-[#2EB1AD]">
                                <span className="text-[10px] uppercase font-black text-[#2eb1ad]">點擊加入內容：</span>
                                {triviaList.map((v, i) => (
                                    <div key={i} onClick={() => { 
                                        const newCap = postData.mainCaption + '\n\n💡 旅遊補充：\n' + v;
                                        setPostData({...postData, mainCaption: newCap}); 
                                        setTriviaList([]); 
                                        saveProjectData({...postData, mainCaption: newCap}); 
                                    }} className="p-3 bg-white rounded-lg text-xs leading-relaxed font-bold text-[#2D3142] cursor-pointer hover:border-[#2EB1AD] border border-transparent shadow-sm">{v}</div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative flex-1 flex flex-col min-h-[260px]">
                        <textarea 
                            value={postData.mainCaption}
                            onChange={e => setPostData({...postData, mainCaption: e.target.value})}
                            onBlur={() => saveProjectData(postData, true)}
                            className="flex-1 min-h-[260px] w-full bg-[#F7F6F3] border border-transparent hover:border-gray-300 rounded-2xl p-5 pb-10 text-lg font-semibold leading-relaxed text-[#2D3142] focus:outline-none focus:border-[#2EB1AD] resize-y transition-colors custom-scrollbar"
                        />
                        <div className="absolute bottom-3 right-4 pl-2 pr-2 text-[12px] font-black text-neutral-400 bg-[#F7F6F3]">
                            {postData.mainCaption.length} 字元
                        </div>
                    </div>
                </div>
            </section>
          </WrapperLeft>

        {isDesktop && <PanelResizeHandle className="hidden lg:flex w-1.5 rounded-full mx-1 cursor-col-resize hover:bg-[#2EB1AD]/80 bg-neutral-200 transition-colors" />}

        {/* Right Column (Visuals & Slides) - Span 7 */}
        <WrapperRight>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Box 3: Visual Style Selection */}
                <section className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-6 bg-[#2EB1AD] rounded-full"></div>
                            <h2 className="font-black text-[#2D3142] text-lg">視覺風格</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {styleOptions.map(opt => (
                               <div 
                                  key={opt.value}
                                  onClick={() => { setSelectedStyle(opt.value); savePrefs({ selectedStyle: opt.value }); }}
                                  className={cn("rounded-xl p-3 relative flex items-center justify-center text-center cursor-pointer transition-all border flex-1 min-w-[120px]", 
                                    selectedStyle === opt.value ? "bg-[#2EB1AD] border-transparent text-white shadow-sm" : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                                  )}
                               >
                                 <span className="text-xs font-black z-10">{opt.label}</span>
                               </div>
                            ))}
                        </div>
                </section>

                {/* Box 4: Setup Character Library */}
                <section className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-1 justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-6 bg-[#f26522] rounded-full"></div>
                            <h2 className="font-black text-[#2D3142] text-lg">角色與版面設計參考</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setUseOriginalImage(!useOriginalImage)}
                                className={cn("text-xs font-black px-3 py-1.5 rounded-xl border transition", useOriginalImage ? "bg-[#2D3142] border-[#2D3142] text-white" : "bg-neutral-100 border-neutral-200 text-neutral-400")}
                            >
                                {useOriginalImage ? '🖼️ 原圖直出 (開啟)' : '🖼️ 原圖直出 (關閉)'}
                            </button>
                            <button 
                                onClick={() => { setIncludeMascot(!includeMascot); savePrefs({ includeMascot: !includeMascot }); }}
                                className={cn("text-xs font-black px-3 py-1.5 rounded-xl border transition", includeMascot ? "bg-[#FFF3E0] border-[#f26522] text-[#f26522]" : "bg-neutral-100 border-neutral-200 text-neutral-400")}
                            >
                                {includeMascot ? '👽 啟用吉祥物' : '🚫 隱藏吉祥物'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-2 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">選擇參考圖</span>
                            <button 
                                onClick={() => setIsLibraryOpen(true)}
                                className="text-[10px] font-black text-[#2EB1AD] bg-[#E0F2F1] px-3 py-1.5 rounded-lg hover:bg-[#B2DFDB] transition"
                            >
                                📚 管理圖庫
                            </button>
                        </div>
                        
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                            {brandLibrary.map(item => {
                                const isSelected = item.category === 'TT' 
                                    ? selectedMascotId === item.id 
                                    : item.category === 'CTA'
                                        ? (postData as any).selectedCtaId === item.id
                                        : selectedLayoutId === item.id;
                                return (
                                <div key={item.id} className="relative group shrink-0">
                                    <img 
                                        src={item.dataUrl} 
                                        className={cn("w-14 h-14 rounded-xl object-cover cursor-pointer border-[3px] transition", 
                                            isSelected 
                                                ? (item.category === 'TT' ? "border-[#f26522]" : item.category === 'CTA' ? "border-purple-500" : "border-[#2EB1AD]") 
                                                : "border-transparent opacity-60 hover:opacity-100"
                                        )} 
                                        onClick={() => {
                                            if (item.category === 'TT') {
                                                setSelectedMascotId(isSelected ? null : item.id);
                                            } else if (item.category === 'CTA') {
                                                const newData = { ...postData, selectedCtaId: isSelected ? undefined : item.id };
                                                setPostData(newData);
                                                saveProjectData(newData, true);
                                            } else {
                                                setSelectedLayoutId(isSelected ? null : item.id);
                                            }
                                        }}
                                    />
                                    <span className={cn("absolute -bottom-1 -right-1 text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full border border-white", 
                                        item.category === 'TT' ? 'bg-[#f26522]' : item.category === 'CTA' ? 'bg-purple-500' : 'bg-[#2EB1AD]'
                                    )}>
                                        {item.category === 'TT' ? '角色' : item.category === 'CTA' ? '結尾圖' : '版面'}
                                    </span>
                                </div>
                            )})}
                            {brandLibrary.length === 0 && (
                                <div className="text-xs text-neutral-400 italic py-2 flex items-center justify-center w-full">尚未上傳任何參考圖...</div>
                            )}
                        </div>

                        <div className="mt-1 flex flex-col gap-1">
                            {selectedMascotId && includeMascot && (
                                <p className="text-[10px] text-[#f26522] font-black">✅ 已選擇角色參考 (保持形狀，變換表情)</p>
                            )}
                            {selectedMascotId && !includeMascot && (
                                <p className="text-[10px] text-red-500 font-black">⚠️ 角色已停用，參考圖將被忽略</p>
                            )}
                            {selectedLayoutId && (
                                <p className="text-[10px] text-[#2EB1AD] font-black">✅ 已選擇版面/風格參考圖 (100% 相似)</p>
                            )}
                            {(postData as any).selectedCtaId && postData.includeCta !== false && (
                                <p className="text-[10px] text-purple-600 font-black">✅ 已選擇自訂結尾呼籲圖 (CTA)</p>
                            )}
                            {(postData as any).selectedCtaId && postData.includeCta === false && (
                                <p className="text-[10px] text-red-500 font-black">⚠️ 結尾頁已停用，自訂結尾圖將被忽略</p>
                            )}
                        </div>

                        <div className="mt-2 pt-3 border-t border-[#E5E7EB] flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="includeCtaLeft"
                                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                checked={postData.includeCta !== false}
                                onChange={e => {
                                    const newData = { ...postData, includeCta: e.target.checked };
                                    if (!e.target.checked && currentSlide === postData.slides.length) {
                                        setCurrentSlide(0);
                                    }
                                    setPostData(newData);
                                    saveProjectData(newData, true);
                                }}
                            />
                            <label htmlFor="includeCtaLeft" className="text-sm font-bold text-neutral-700 cursor-pointer">
                                加入結尾行動呼籲頁面 (Include CTA Page)
                            </label>
                        </div></div>
                </section>
            </div>

            <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col gap-6">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-6 bg-[#6366f1] rounded-full"></div>
                    <h2 className="font-black text-[#2D3142] text-lg">文字設計排版 (Global Typography)</h2>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Subject */}
                    <div className="bg-[#F7F6F3] p-5 rounded-2xl flex flex-col gap-4 border border-[#E5E7EB]">
                        <h3 className="font-black text-[#6366f1] text-sm flex items-center gap-2 uppercase tracking-wider">A 標題設計 (Subject)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">標題字體 (Font)</label>
                                <Select 
                                    value={(postData.designSettings || defaultData.designSettings).titleFontFamily || (postData.designSettings || defaultData.designSettings).fontFamily || 'Inter'} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, titleFontFamily: val } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                        <SelectValue placeholder="選擇字體" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fontOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} style={{fontFamily: opt.value}}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">特效 (Effect)</label>
                                <Select 
                                    value={(postData.designSettings || defaultData.designSettings).titleTextEffect || (postData.designSettings || defaultData.designSettings).textEffect || 'shadow'} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, titleTextEffect: val } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                        <SelectValue placeholder="選擇特效" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">無特效 (None)</SelectItem>
                                        <SelectItem value="shadow">陰影 (Shadow)</SelectItem>
                                        <SelectItem value="outline">描邊 (Outline)</SelectItem>
                                        <SelectItem value="neon">霓虹發光 (Neon)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">大小 (Size)</label>
                                <Select 
                                    value={String((postData.designSettings || defaultData.designSettings).titleSize)} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, titleSize: Number(val) } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-xs font-bold px-2">
                                        <SelectValue placeholder="T" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="60">小 (60px)</SelectItem>
                                        <SelectItem value="80">中 (80px)</SelectItem>
                                        <SelectItem value="100">大 (100px)</SelectItem>
                                        <SelectItem value="120">特大 (120px)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">顏色 (Color)</label>
                                <div className="h-10">
                                    <input 
                                        type="color" 
                                        className="w-full h-full rounded-xl cursor-pointer bg-white border border-[#E5E7EB]" 
                                        value={(postData.designSettings || defaultData.designSettings).titleColor}
                                        onChange={e => {
                                            const newData = { ...postData, designSettings: { ...postData.designSettings, titleColor: e.target.value } };
                                            setPostData(newData);
                                        }}
                                        onBlur={() => saveProjectData(postData, true)}
                                        title="標題顏色"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-[#F7F6F3] p-5 rounded-2xl flex flex-col gap-4 border border-[#E5E7EB]">
                        <h3 className="font-bold text-neutral-600 text-sm flex items-center gap-2 uppercase tracking-wider">a 內文設計 (Content)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">內文字體 (Font)</label>
                                <Select 
                                    value={(postData.designSettings || defaultData.designSettings).bodyFontFamily || (postData.designSettings || defaultData.designSettings).fontFamily || 'Inter'} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, bodyFontFamily: val } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                        <SelectValue placeholder="選擇字體" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fontOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} style={{fontFamily: opt.value}}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">特效 (Effect)</label>
                                <Select 
                                    value={(postData.designSettings || defaultData.designSettings).bodyTextEffect || (postData.designSettings || defaultData.designSettings).textEffect || 'shadow'} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, bodyTextEffect: val } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                        <SelectValue placeholder="選擇特效" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">無特效 (None)</SelectItem>
                                        <SelectItem value="shadow">陰影 (Shadow)</SelectItem>
                                        <SelectItem value="outline">描邊 (Outline)</SelectItem>
                                        <SelectItem value="neon">霓虹發光 (Neon)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">大小 (Size)</label>
                                <Select 
                                    value={String((postData.designSettings || defaultData.designSettings).bodySize)} 
                                    onValueChange={val => {
                                        const newData = { ...postData, designSettings: { ...postData.designSettings, bodySize: Number(val) } };
                                        setPostData(newData);
                                        saveProjectData(newData, true);
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-xl text-xs font-bold px-2">
                                        <SelectValue placeholder="B" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="36">小 (36px)</SelectItem>
                                        <SelectItem value="46">中 (46px)</SelectItem>
                                        <SelectItem value="56">大 (56px)</SelectItem>
                                        <SelectItem value="66">特大 (66px)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">顏色 (Color)</label>
                                <div className="h-10">
                                    <input 
                                        type="color" 
                                        className="w-full h-full rounded-xl cursor-pointer bg-white border border-[#E5E7EB]" 
                                        value={(postData.designSettings || defaultData.designSettings).bodyColor}
                                        onChange={e => {
                                            const newData = { ...postData, designSettings: { ...postData.designSettings, bodyColor: e.target.value } };
                                            setPostData(newData);
                                        }}
                                        onBlur={() => saveProjectData(postData, true)}
                                        title="內文顏色"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[#E5E7EB]">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">版面風格 (Layout Style)</label>
                        <Select 
                            value={(postData.designSettings || defaultData.designSettings).layoutStyle} 
                            onValueChange={val => {
                                const newData = { ...postData, designSettings: { ...postData.designSettings, layoutStyle: val } };
                                setPostData(newData);
                                saveProjectData(newData, true);
                            }}
                        >
                            <SelectTrigger className="w-full bg-[#F7F6F3] border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                <SelectValue placeholder="選擇版面" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gradient">💡 漸層暈影 (推薦)</SelectItem>
                                <SelectItem value="glass">🧊 玻璃透視</SelectItem>
                                <SelectItem value="solid">⬛ 純黑底色</SelectItem>
                                <SelectItem value="textOnly">📝 純文字無底</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-neutral-500 font-bold block">效果強度 (Opacity)</label>
                        <Select 
                            value={String((postData.designSettings || defaultData.designSettings).layoutOpacity ?? 100)} 
                            onValueChange={val => {
                                const newData = { ...postData, designSettings: { ...postData.designSettings, layoutOpacity: Number(val) } };
                                setPostData(newData);
                                saveProjectData(newData, true);
                            }}
                        >
                            <SelectTrigger className="w-full bg-[#F7F6F3] border focus:border-[#6366f1] rounded-xl text-sm font-bold">
                                <SelectValue placeholder="100%" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="100">100%</SelectItem>
                                <SelectItem value="75">75%</SelectItem>
                                <SelectItem value="50">50%</SelectItem>
                                <SelectItem value="25">25%</SelectItem>
                                <SelectItem value="0">0% (無效果)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Box 6: Content Editor & Pagination */}
            <section className="bg-white border border-[#E5E7EB] shadow-sm rounded-3xl p-6 flex flex-col flex-1">
                <div className="flex justify-between items-center mb-6 gap-4 overflow-x-auto pb-2 scrollbar-none">
                    <div className="flex gap-2">
                        {postData.slides.map((s, idx) => (
                           <button 
                              key={s.id}
                              onClick={() => setCurrentSlide(idx)}
                              className={cn("px-4 py-2 border rounded-xl text-sm transition-all whitespace-nowrap font-black",
                                currentSlide === idx ? "bg-[#2EB1AD] text-white border-[#2EB1AD] shadow-sm scale-105" : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                              )}
                           >
                              第 {idx + 1} 頁
                              {images[s.id] && <Check className="w-4 h-4 ml-1.5 inline text-white" />}
                           </button>
                        ))}
                        {postData.includeCta !== false && (
                            <div 
                               className="px-4 py-2 border rounded-xl text-sm transition-all whitespace-nowrap font-black bg-purple-50 border-purple-200 text-purple-600 cursor-default select-none shadow-sm flex items-center gap-1.5"
                               title="結尾行動呼籲頁面已啟用（請在左側選擇結尾圖）"
                            >
                               <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                               結尾 CTA 頁
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleGenerateAllImages}
                            disabled={isGeneratingAllImages}
                            className="shrink-0 px-4 py-2 bg-[#F26522] text-white hover:bg-[#D9531E] rounded-xl text-sm font-bold whitespace-nowrap transition-colors shadow-sm active:translate-y-0.5 disabled:opacity-50 disabled:active:translate-y-0"
                        >
                            {isGeneratingAllImages ? '🤖 生成中...' : '📸 批量生成缺失圖片'}
                        </button>
                        <span className="text-[10px] font-black text-[#f26522] bg-[#FFF3E0] border border-[#f26522] px-3 py-1.5 rounded-full uppercase tracking-widest shrink-0">Drafting Content</span>
                    </div>
                </div>

                {(postData.slides[currentSlide] || currentSlide === postData.slides.length) && (
                    <div className="flex flex-col lg:flex-row gap-6">
                        
                        {/* Live Mockup Preview */}
                        <div className="w-full lg:w-[460px] xl:w-[480px] shrink-0 flex flex-col gap-3">
                            <div className="bg-[#2D3142] rounded-3xl p-4 flex flex-col overflow-hidden relative shadow-lg border border-transparent">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#2EB1AD]"></div>
                                    <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Preview: IG Post</span>
                                </div>
                                
                                <div className="relative">
                                    <div className="rounded-2xl bg-[#1A1A24] relative overflow-hidden aspect-[4/5] flex items-center justify-center border border-white/10 w-full" style={{ containerType: 'inline-size' }}>
                                        <div 
                                            className="bg-white overflow-hidden relative w-full h-full"
                                        >
                                            {currentSlide === postData.slides.length ? (
                                                <CtaSlideContent selectedCtaUrl={selectedCtaUrl} />
                                            ) : images[postData.slides[currentSlide].id] ? (
                                            <img 
                                                src={images[postData.slides[currentSlide].id]} 
                                                className="absolute inset-0 w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500" 
                                                onClick={() => setEnlargedImage({url: images[postData.slides[currentSlide].id], slideIdx: currentSlide})}
                                            />
                                            ) : (
                                                <div className="text-neutral-400 flex flex-col items-center justify-center h-full w-full">
                                                    <ImageIcon className="w-12 h-12 md:w-16 md:h-16 opacity-30 mb-8" />
                                                    <p className="font-bold opacity-70 text-lg md:text-xl">等待生成圖像...</p>
                                                </div>
                                            )}

                                            {currentSlide !== postData.slides.length && images[postData.slides[currentSlide].id] && (
                                                <div className="absolute top-4 right-4 z-[60]">
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const s = postData.slides[currentSlide];
                                                            const slideId = s.id;
                                                            setLoadingDesignSuggestion(prev => ({...prev, [slideId]: true}));
                                                            try {
                                                                const suggestion = await generateDesignSuggestion(images[slideId], s.imageText, s.imageBody);
                                                                const ns = [...postData.slides];
                                                                const currentDs = (ns[currentSlide] as any).designSettings || postData.designSettings || defaultData.designSettings;
                                                                (ns[currentSlide] as any).designSettings = {
                                                                    ...currentDs,
                                                                    titleFontFamily: suggestion.titleFontFamily || currentDs.titleFontFamily || currentDs.fontFamily,
                                                                    titleTextEffect: suggestion.titleTextEffect || currentDs.titleTextEffect || currentDs.textEffect || 'shadow',
                                                                    titleSize: suggestion.titleSize || currentDs.titleSize,
                                                                    titleColor: suggestion.titleColor || currentDs.titleColor,
                                    bodyFontFamily: suggestion.bodyFontFamily || currentDs.bodyFontFamily || currentDs.fontFamily,
                                                                    bodyTextEffect: suggestion.bodyTextEffect || currentDs.bodyTextEffect || currentDs.textEffect || 'shadow',
                                                                    bodySize: suggestion.bodySize || currentDs.bodySize,
                                                                    bodyColor: suggestion.bodyColor || currentDs.bodyColor,
                                                                    layoutStyle: suggestion.layoutStyle || currentDs.layoutStyle,
                                                                    layoutOpacity: suggestion.layoutOpacity ?? currentDs.layoutOpacity,
                                                                };
                                                                setPostData({...postData, slides: ns});
                                                                saveProjectData({...postData, slides: ns}, true);
                                                            } catch (err) {
                                                                console.error(err);
                                                            }
                                                            setLoadingDesignSuggestion(prev => ({...prev, [slideId]: false}));
                                                        }}
                                                        disabled={loadingDesignSuggestion[postData.slides[currentSlide].id]}
                                                        className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-3 py-2 rounded-full flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
                                                    >
                                                        {loadingDesignSuggestion[postData.slides[currentSlide].id] ? <Loader2 className="animate-spin w-3.5 h-3.5 text-[#f26522]" /> : <SparklesIcon className="w-3.5 h-3.5 text-[#f26522]" />}
                                                        AI 智能排版與配色建議
                                                    </button>
                                                </div>
                                            )}

                                            {currentSlide !== postData.slides.length && (
                                                <div 
                                                    className={cn("absolute left-0 right-0 pointer-events-none", getOuterLayoutBgClass(postData.slides[currentSlide].textPosition as any, currentSlide))}
                                                    style={getLayoutPaddingStyle(postData.slides[currentSlide].textPosition as any, currentSlide)}
                                                >
                                                    <div className={cn("flex flex-col relative z-50 pointer-events-auto", getInnerLayoutBgClass(currentSlide))} style={{ gap: '2.22cqw' }}>
                                                        <TextareaAutosize 
                                                            value={postData.slides[currentSlide].imageText || ''}
                                                            onChange={(e) => {
                                                                const ns = [...postData.slides];
                                                                ns[currentSlide].imageText = e.target.value;
                                                                setPostData({...postData, slides: ns});
                                                            }}
                                                            onBlur={() => saveProjectData({...postData}, true)}
                                                            placeholder="標題..."
                                                            className="w-full font-black leading-tight drop-shadow-md outline-none bg-transparent resize-none overflow-hidden border-0 p-0 m-0 cursor-text focus:ring-0 focus:outline-none whitespace-pre-wrap"
                                                            style={getTextStyle(true, currentSlide)}
                                                        />
                                                        <TextareaAutosize 
                                                            value={postData.slides[currentSlide].imageBody || ''}
                                                            onChange={(e) => {
                                                                const ns = [...postData.slides];
                                                                ns[currentSlide].imageBody = e.target.value;
                                                                setPostData({...postData, slides: ns});
                                                            }}
                                                            onBlur={() => saveProjectData({...postData}, true)}
                                                            placeholder="內容..."
                                                            className="w-full font-semibold leading-relaxed drop-shadow-sm outline-none bg-transparent resize-none overflow-hidden border-0 p-0 m-0 cursor-text focus:ring-0 focus:outline-none placeholder:text-white/30"
                                                            style={getTextStyle(false, currentSlide)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {currentSlide !== postData.slides.length && loadingSlide[postData.slides[currentSlide].id] && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center z-10">
                                                <Loader2 className="animate-spin text-[#f26522] w-10 h-10 mb-3" />
                                                <span className="text-[#2D3142] font-black text-xs uppercase tracking-widest">Generating...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Download Single Image Button */}
                            {currentSlide !== postData.slides.length ? (
                                <button 
                                    onClick={async () => {
                                        if (images[postData.slides[currentSlide].id]) {
                                            showCopyStatus('📸 準備圖片中...');
                                            try {
                                                const el = document.getElementById(`export-slide-${currentSlide}`);
                                                if (!el) return;
                                                // Pass 1: Warm up Safari's image decoder cache (fixes first-time blank images)
                                                await htmlToImage.toJpeg(el, { quality: 0.1, canvasWidth: 1080, canvasHeight: 1350, skipFonts: true });
                                                // Pass 2: The actual high-quality capture
                                                const dataUrl = await htmlToImage.toJpeg(el, { 
                                                    quality: 0.95, 
                                                    canvasWidth: 1080, 
                                                    canvasHeight: 1350,
                                                    pixelRatio: 1,
                                                    skipFonts: false,
                                                    cacheBust: true
                                                });
                                                const a = document.createElement('a');
                                                a.href = dataUrl;
                                                a.download = `traveltopia_ig_slide_${currentSlide + 1}.jpg`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                showCopyStatus(`✅ 第 ${currentSlide + 1} 頁已下載！`);
                                            } catch (e) {
                                                showCopyStatus('⚠️ 下載失敗');
                                            }
                                        } else {
                                            showCopyStatus(`⚠️ 請先生成圖片`);
                                        }
                                    }}
                                    className="w-full py-3 bg-[#F7F6F3] text-[#2D3142] hover:bg-white hover:text-[#f26522] border border-[#E5E7EB] rounded-2xl text-sm font-black transition-colors flex justify-center items-center gap-2 shadow-sm"
                                >
                                    ⬇️ 下載含文字版面圖片
                                </button>
                            ) : (
                                <button 
                                    onClick={async () => {
                                        showCopyStatus('📸 準備圖片中...');
                                        try {
                                            const el = document.getElementById(`export-slide-cta`);
                                            if (!el) return;
                                            // Pass 1: Warm up Safari's image decoder cache (fixes first-time blank images)
                                            await htmlToImage.toJpeg(el, { quality: 0.1, canvasWidth: 1080, canvasHeight: 1350, skipFonts: true });
                                            // Pass 2: The actual high-quality capture
                                            const dataUrl = await htmlToImage.toJpeg(el, { 
                                                quality: 0.95, 
                                                canvasWidth: 1080, 
                                                canvasHeight: 1350,
                                                pixelRatio: 1,
                                                skipFonts: false,
                                                cacheBust: true
                                            });
                                            const a = document.createElement('a');
                                            a.href = dataUrl;
                                            a.download = `traveltopia_ig_slide_cta.jpg`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            showCopyStatus(`✅ 結尾行動呼籲頁已下載！`);
                                        } catch (e) {
                                            showCopyStatus('⚠️ 下載失敗');
                                        }
                                    }}
                                    className="w-full py-3 bg-[#F7F6F3] text-[#2D3142] hover:bg-white hover:text-[#f26522] border border-[#E5E7EB] rounded-2xl text-sm font-black transition-colors flex justify-center items-center gap-2 shadow-sm"
                                >
                                    ⬇️ 下載結尾行動呼籲頁圖片
                                </button>
                            )}
                        </div>

                        {/* Slide Content Editor */}
                        {currentSlide === postData.slides.length ? (
                            <div className="flex-1 bg-[#F7F6F3] border border-dashed border-[#E5E7EB] rounded-3xl p-6 flex flex-col gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-6 bg-[#f26522] rounded-full"></div>
                                    <h3 className="text-lg font-black text-[#2D3142]">結尾行動呼籲頁面 (CTA Page)</h3>
                                </div>

                                <div className="flex flex-col gap-4 text-left">
                                    <div>
                                        <label className="text-xs text-neutral-500 uppercase font-black tracking-wider block mb-2">
                                            版面類型
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => {
                                                    const newData = { ...postData, selectedCtaId: undefined };
                                                    setPostData(newData);
                                                    saveProjectData(newData, true);
                                                }}
                                                className={cn("px-4 py-3 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-1", 
                                                    !(postData as any).selectedCtaId ? "bg-white border-[#f26522] text-[#f26522] shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                                )}
                                            >
                                                <span>旅遊邦預設設計</span>
                                                <span className="text-[10px] opacity-70 font-normal">Follow Us 固定排版</span>
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const firstCta = brandLibrary.find(item => item.category === 'CTA');
                                                    const newData = { ...postData, selectedCtaId: firstCta?.id || 'upload_prompt' };
                                                    setPostData(newData);
                                                    saveProjectData(newData, true);
                                                }}
                                                className={cn("px-4 py-3 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-1", 
                                                    (postData as any).selectedCtaId ? "bg-white border-[#f26522] text-[#f26522] shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                                )}
                                            >
                                                <span>自訂上傳圖片</span>
                                                <span className="text-[10px] opacity-70 font-normal">使用自訂的 IG 結尾圖</span>
                                            </button>
                                        </div>
                                    </div>

                                    {(postData as any).selectedCtaId && (
                                        <div className="border-t border-[#E5E7EB] pt-4 mt-2 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">選擇自訂結尾圖</span>
                                                <label className="text-xs font-black text-white bg-[#2EB1AD] px-3 py-1.5 rounded-lg hover:bg-[#259b97] cursor-pointer transition flex items-center gap-1">
                                                    <Upload className="w-3.5 h-3.5" /> 上傳圖片
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadToLibrary(e, 'CTA')} />
                                                </label>
                                            </div>

                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                                                {brandLibrary.filter(item => item.category === 'CTA').map(item => {
                                                    const isSelected = (postData as any).selectedCtaId === item.id;
                                                    return (
                                                        <div key={item.id} className="relative group shrink-0">
                                                            <img 
                                                                src={item.dataUrl} 
                                                                className={cn("w-16 h-16 rounded-xl object-cover cursor-pointer border-[3px] transition", 
                                                                    isSelected ? "border-[#f26522]" : "border-transparent opacity-60 hover:opacity-100"
                                                                )} 
                                                                onClick={() => {
                                                                    const newData = { ...postData, selectedCtaId: item.id };
                                                                    setPostData(newData);
                                                                    saveProjectData(newData, true);
                                                                }}
                                                            />
                                                            <button 
                                                                 onClick={(e) => handleDeleteLibrary(item.id, e)}
                                                                 className="absolute top-0.5 right-0.5 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <TrashIcon className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {brandLibrary.filter(item => item.category === 'CTA').length === 0 && (
                                                    <div className="text-xs text-neutral-400 italic py-4 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl w-full bg-white gap-2">
                                                        <span>尚未上傳任何自訂結尾圖...</span>
                                                        <label className="text-[10px] font-black text-[#2EB1AD] bg-[#E0F2F1] px-2 py-1 rounded hover:bg-[#B2DFDB] cursor-pointer transition">
                                                            立即上傳
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadToLibrary(e, 'CTA')} />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-xs text-neutral-400 bg-neutral-100 rounded-xl p-3 border border-neutral-200 leading-relaxed mt-2">
                                        💡 提示：您上傳的圖片會自動儲存到您的雲端品牌圖庫中，所有專案都可以隨時取用。建議上傳 1080x1350 比例 of JPG 圖片以達最佳滿版效果。
                                    </div>
                                </div>
                            </div>
                        ) : (
                        <div className="flex-1 bg-[#F7F6F3] border border-dashed border-[#E5E7EB] rounded-3xl p-6 flex flex-col gap-5">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-6 bg-[#f26522] rounded-full"></div>
                                <h3 className="text-lg font-black text-[#2D3142]">內容編輯器 (Slide Content)</h3>
                            </div>
                            
                            <div className="bg-[#FFF3E0] text-[#f26522] text-xs font-bold px-3 py-2 rounded-lg border border-[#FFE0B2] flex items-center gap-2">
                                💡 提示：你也可以直接點擊左側圖片上的文字進行快速編輯！
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-neutral-500 uppercase font-black tracking-wider">標題文字</label>
                                        <button 
                                            onClick={async () => {
                                                const s = postData.slides[currentSlide];
                                                if(!s.imageText && !s.imageBody) return;
                                                setIsGeneratingSlideText(true);
                                                try {
                                                    const res = await generateSlideTextRewrite(postData.mainCaption, `${s.imageText}\n${s.imageBody}`, language);
                                                    const ns = [...postData.slides];
                                                    ns[currentSlide].imageText = res.imageText || s.imageText;
                                                    ns[currentSlide].imageBody = res.imageBody || s.imageBody;
                                                    setPostData({...postData, slides: ns});
                                                    saveProjectData({...postData, slides: ns}, true);
                                                    showCopyStatus('✅ 單頁文案已潤飾！');
                                                } catch(e) {}
                                                setIsGeneratingSlideText(false);
                                            }}
                                            disabled={isGeneratingSlideText}
                                            className="text-[10px] bg-[#FFF3E0] text-[#f26522] hover:bg-[#FFE0B2] px-2 py-1 rounded font-bold transition disabled:opacity-50"
                                        >
                                            {isGeneratingSlideText ? '✨ 潤飾中...' : '✨ AI 潤飾文案'}
                                        </button>
                                    </div>
                                    <button onClick={() => {
                                        const ns = [...postData.slides];
                                        ns[currentSlide] = { 
                                            ...ns[currentSlide], 
                                            textPosition: ns[currentSlide].textPosition === 'top' ? 'bottom' : 'top' 
                                        };
                                        setPostData({...postData, slides: ns});
                                        saveProjectData({...postData, slides: ns}, true);
                                    }} className="text-xs text-[#2D3142] font-black bg-white border border-[#E5E7EB] hover:bg-[#FFF3E0] px-3 py-1.5 rounded-xl transition shadow-sm active:translate-y-0 text-[#f26522]">
                                        排版：{postData.slides[currentSlide].textPosition === 'top' ? '頂部' : '底部'}
                                    </button>
                                </div>
                                <input 
                                    value={postData.slides[currentSlide].imageText || ''} 
                                    onChange={e => {
                                        const ns = [...postData.slides];
                                        ns[currentSlide].imageText = e.target.value;
                                        setPostData({...postData, slides: ns});
                                    }}
                                    onBlur={() => saveProjectData(postData, true)}
                                    className="w-full bg-transparent text-2xl font-black text-[#2D3142] focus:outline-none border-b border-transparent focus:border-[#2EB1AD] pb-1 transition-all"
                                />
                            </div>

                            <div className="flex-1 flex flex-col gap-2">
                                <label className="text-xs text-neutral-500 uppercase font-black tracking-wider">內文描述</label>
                                <textarea 
                                    value={postData.slides[currentSlide].imageBody || ''} 
                                    onChange={e => {
                                        const ns = [...postData.slides];
                                        ns[currentSlide].imageBody = e.target.value;
                                        setPostData({...postData, slides: ns});
                                    }}
                                    onBlur={() => saveProjectData(postData, true)}
                                    className="flex-1 w-full bg-transparent resize-none text-base font-semibold text-[#2D3142] leading-relaxed focus:outline-none min-h-[100px]"
                                />
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="overrideDesign"
                                        checked={!!(postData.slides[currentSlide] as any).designSettings}
                                        onChange={e => {
                                            const ns = [...postData.slides];
                                            if (e.target.checked) {
                                                (ns[currentSlide] as any).designSettings = { ...(postData.designSettings || defaultData.designSettings) };
                                            } else {
                                                delete (ns[currentSlide] as any).designSettings;
                                            }
                                            setPostData({...postData, slides: ns});
                                            saveProjectData({...postData, slides: ns}, true);
                                        }}
                                        className="w-4 h-4 rounded text-[#2EB1AD] focus:ring-[#2EB1AD]"
                                    />
                                    <label htmlFor="overrideDesign" className="text-sm font-bold text-[#2D3142] select-none cursor-pointer">
                                        使用獨立設計風格 (覆蓋全局設定)
                                    </label>
                                </div>
                                {(postData.slides[currentSlide] as any).designSettings && (() => {
                                    const ds = (postData.slides[currentSlide] as any).designSettings;
                                    const slideId = postData.slides[currentSlide].id;
                                    return (
                                        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-6">
                                            {images[slideId] && (
                                                <button
                                                    onClick={async () => {
                                                        const s = postData.slides[currentSlide];
                                                        setLoadingDesignSuggestion(prev => ({...prev, [slideId]: true}));
                                                        try {
                                                            const suggestion = await generateDesignSuggestion(images[slideId], s.imageText, s.imageBody);
                                                            const ns = [...postData.slides];
                                                            (ns[currentSlide] as any).designSettings = {
                                                                ...ds,
                                                                titleFontFamily: suggestion.titleFontFamily || ds.titleFontFamily || ds.fontFamily,
                                                                titleTextEffect: suggestion.titleTextEffect || ds.titleTextEffect || ds.textEffect || 'shadow',
                                                                titleSize: suggestion.titleSize || ds.titleSize,
                                                                titleColor: suggestion.titleColor || ds.titleColor,
                                                                bodyFontFamily: suggestion.bodyFontFamily || ds.bodyFontFamily || ds.fontFamily,
                                                                bodyTextEffect: suggestion.bodyTextEffect || ds.bodyTextEffect || ds.textEffect || 'shadow',
                                                                bodySize: suggestion.bodySize || ds.bodySize,
                                                                bodyColor: suggestion.bodyColor || ds.bodyColor,
                                                                layoutStyle: suggestion.layoutStyle || ds.layoutStyle,
                                                                layoutOpacity: suggestion.layoutOpacity ?? ds.layoutOpacity,
                                                            };
                                                            setPostData({...postData, slides: ns});
                                                            saveProjectData({...postData, slides: ns}, true);
                                                        } catch (e) {
                                                            console.error(e);
                                                        }
                                                        setLoadingDesignSuggestion(prev => ({...prev, [slideId]: false}));
                                                    }}
                                                    disabled={loadingDesignSuggestion[slideId]}
                                                    className="w-full py-2 bg-[#6366f1] text-white rounded-xl text-sm font-bold hover:bg-[#4f46e5] transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                                                >
                                                    {loadingDesignSuggestion[slideId] ? <Loader2 className="animate-spin w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                                    ✨ AI 智能排版與配色建議 (根據現有圖片)
                                                </button>
                                            )}

                                            <div className="flex flex-col gap-6">
                                                {/* Subject */}
                                                <div className="bg-[#F7F6F3] p-4 rounded-xl flex flex-col gap-4 border border-[#E5E7EB]">
                                                    <h3 className="font-black text-[#6366f1] text-xs flex items-center gap-2 uppercase tracking-wider">A 標題設定</h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">字體</label>
                                                            <Select 
                                                                value={ds.titleFontFamily || ds.fontFamily || 'Inter'} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.titleFontFamily = val;
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {fontOptions.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value} style={{fontFamily: opt.value}}>{opt.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">特效</label>
                                                            <Select 
                                                                value={ds.titleTextEffect || ds.textEffect || 'shadow'} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.titleTextEffect = val;
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">無 (None)</SelectItem>
                                                                    <SelectItem value="shadow">陰影 (Shadow)</SelectItem>
                                                                    <SelectItem value="outline">描邊 (Outline)</SelectItem>
                                                                    <SelectItem value="neon">發光 (Neon)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">大小</label>
                                                            <Select 
                                                                value={String(ds.titleSize)} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.titleSize = Number(val);
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {[120, 100, 80, 60, 40].map(size => (
                                                                        <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">顏色</label>
                                                            <input 
                                                                type="color" 
                                                                className="w-full h-8 rounded-lg cursor-pointer bg-white border border-[#E5E7EB]" 
                                                                value={ds.titleColor}
                                                                onChange={e => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.titleColor = e.target.value;
                                                                    setPostData({...postData, slides: ns});
                                                                }}
                                                                onBlur={() => saveProjectData(postData, true)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="bg-[#F7F6F3] p-4 rounded-xl flex flex-col gap-4 border border-[#E5E7EB]">
                                                    <h3 className="font-bold text-neutral-600 text-xs flex items-center gap-2 uppercase tracking-wider">a 內文設定</h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">字體</label>
                                                            <Select 
                                                                value={ds.bodyFontFamily || ds.fontFamily || 'Inter'} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.bodyFontFamily = val;
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {fontOptions.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value} style={{fontFamily: opt.value}}>{opt.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">特效</label>
                                                            <Select 
                                                                value={ds.bodyTextEffect || ds.textEffect || 'shadow'} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.bodyTextEffect = val;
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">無 (None)</SelectItem>
                                                                    <SelectItem value="shadow">陰影 (Shadow)</SelectItem>
                                                                    <SelectItem value="outline">描邊 (Outline)</SelectItem>
                                                                    <SelectItem value="neon">發光 (Neon)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">大小</label>
                                                            <Select 
                                                                value={String(ds.bodySize)} 
                                                                onValueChange={val => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.bodySize = Number(val);
                                                                    setPostData({...postData, slides: ns});
                                                                    saveProjectData({...postData, slides: ns}, true);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border focus:border-[#6366f1] rounded-lg text-xs font-bold px-2 h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {[80, 60, 46, 36, 24].map(size => (
                                                                        <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">顏色</label>
                                                            <input 
                                                                type="color" 
                                                                className="w-full h-8 rounded-lg cursor-pointer bg-white border border-[#E5E7EB]" 
                                                                value={ds.bodyColor}
                                                                onChange={e => {
                                                                    const ns = [...postData.slides];
                                                                    (ns[currentSlide] as any).designSettings.bodyColor = e.target.value;
                                                                    setPostData({...postData, slides: ns});
                                                                }}
                                                                onBlur={() => saveProjectData(postData, true)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">版面風格</label>
                                                    <Select 
                                                        value={ds.layoutStyle} 
                                                        onValueChange={val => {
                                                            const ns = [...postData.slides];
                                                            (ns[currentSlide] as any).designSettings.layoutStyle = val;
                                                            setPostData({...postData, slides: ns});
                                                            saveProjectData({...postData, slides: ns}, true);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full bg-[#F7F6F3] border focus:border-[#6366f1] rounded-lg text-xs font-bold h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="gradient">平滑漸層</SelectItem>
                                                            <SelectItem value="solid">實色遮罩</SelectItem>
                                                            <SelectItem value="glass">毛玻璃</SelectItem>
                                                            <SelectItem value="textOnly">純文字</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">效果強度</label>
                                                    <Select 
                                                        value={String(ds.layoutOpacity ?? 100)} 
                                                        onValueChange={val => {
                                                            const ns = [...postData.slides];
                                                            (ns[currentSlide] as any).designSettings.layoutOpacity = Number(val);
                                                            setPostData({...postData, slides: ns});
                                                            saveProjectData({...postData, slides: ns}, true);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full bg-[#F7F6F3] border focus:border-[#6366f1] rounded-lg text-xs font-bold h-8">
                                                            <SelectValue placeholder="100%" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="100">100%</SelectItem>
                                                            <SelectItem value="75">75%</SelectItem>
                                                            <SelectItem value="50">50%</SelectItem>
                                                            <SelectItem value="25">25%</SelectItem>
                                                            <SelectItem value="0">0%</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="block h-[1px] w-full bg-gray-200 my-1" />

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">AI 圖片提示詞 (可手動修改)</label>
                                            <button 
                                                onClick={async () => {
                                                    const s = postData.slides[currentSlide];
                                                    setIsGeneratingSlidePrompt(true);
                                                    try {
                                                        const p = await generateSlidePrompt(postData.mainCaption, `${s.imageText}\n${s.imageBody}`);
                                                        const ns = [...postData.slides];
                                                        ns[currentSlide].imagePrompt = p.promptEn;
                                                        ns[currentSlide].imagePromptZh = p.promptZh;
                                                        setPostData({...postData, slides: ns});
                                                        saveProjectData({...postData, slides: ns}, true);
                                                    } catch(e) {}
                                                    setIsGeneratingSlidePrompt(false);
                                                }}
                                                disabled={isGeneratingSlidePrompt}
                                                className="text-[10px] bg-[#E0F2F1] text-[#2EB1AD] hover:bg-[#B2DFDB] px-2 py-1 rounded font-bold transition disabled:opacity-50"
                                            >
                                                {isGeneratingSlidePrompt ? '🤖 生成中...' : '🤖 AI 自動填寫提示詞'}
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const ns = [...postData.slides];
                                                ns[currentSlide].imagePrompt = '';
                                                ns[currentSlide].imagePromptZh = '';
                                                setPostData({...postData, slides: ns});
                                                const newInstr = {...slideInstructions};
                                                delete newInstr[postData.slides[currentSlide].id];
                                                setSlideInstructions(newInstr);
                                            }}
                                            className="text-[10px] text-red-500 hover:text-red-600 bg-red-50 px-2 py-1 rounded font-bold transition whitespace-nowrap"
                                        >
                                            🗑️ 清除指令
                                        </button>
                                    </div>
                                    <div className="flex-1 flex bg-white border border-[#E5E7EB] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#2EB1AD]/50 transition min-h-[250px] shadow-sm">
                                        <textarea 
                                            value={postData.slides[currentSlide].imagePrompt || ''}
                                            onChange={e => {
                                                const ns = [...postData.slides];
                                                ns[currentSlide].imagePrompt = e.target.value;
                                                setPostData({...postData, slides: ns});
                                            }}
                                            onBlur={() => saveProjectData(postData, true)}
                                            placeholder="輸入圖片提示詞 (例如: A beautiful sunset over London)..."
                                            className="w-full px-4 py-3 text-sm font-bold bg-transparent focus:outline-none text-[#2D3142] resize-y custom-scrollbar h-full min-h-[250px]"
                                        />
                                    </div>
                                    {postData.slides[currentSlide].imagePromptZh !== undefined && (
                                        <div className="flex-1 flex bg-neutral-50 border border-[#E5E7EB] rounded-xl overflow-hidden min-h-[80px] shadow-sm mt-1 focus-within:ring-2 focus-within:ring-[#2EB1AD]/50 transition">
                                            <textarea
                                                value={postData.slides[currentSlide].imagePromptZh || ''}
                                                onChange={e => {
                                                    const ns = [...postData.slides];
                                                    ns[currentSlide].imagePromptZh = e.target.value;
                                                    setPostData({...postData, slides: ns});
                                                }}
                                                onBlur={() => saveProjectData(postData, true)}
                                                placeholder="💡 中文圖片描述..."
                                                className="w-full px-4 py-3 text-sm font-bold bg-transparent focus:outline-none text-neutral-500 resize-y custom-scrollbar h-full min-h-[80px] leading-relaxed"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 flex bg-white border border-[#E5E7EB] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#f26522]/50 transition min-h-[46px] shadow-sm mt-1">
                                        <input 
                                            value={slideInstructions[postData.slides[currentSlide].id] || ''}
                                            onChange={e => setSlideInstructions(p => ({...p, [postData.slides[currentSlide].id]: e.target.value}))}
                                            placeholder="💡 添加風格與角色指示 (例如: 改成夜晚，角色喝咖啡)"
                                            className="w-full px-4 py-3 text-sm font-bold bg-transparent focus:outline-none text-[#2D3142] h-full"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 self-start h-[46px] mt-1">
                                    <button 
                                        onClick={() => handleGenerateImage(currentSlide)} 
                                        disabled={loadingSlide[postData.slides[currentSlide].id]}
                                        className="h-full px-4 bg-[#2EB1AD] text-white border border-transparent rounded-xl text-sm font-black flex justify-center items-center gap-2 hover:bg-[#209f9b] transition-colors shadow-sm whitespace-nowrap active:translate-y-0.5"
                                    >
                                        {images[postData.slides[currentSlide].id] ? <RefreshCw className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                        <span>
                                            {images[postData.slides[currentSlide].id] ? '重新生成' : '生成圖像'}
                                        </span>
                                    </button>
                                    
                                    {images[postData.slides[currentSlide].id] && (
                                        <button 
                                            onClick={() => {
                                                setEnlargedImage({url: images[postData.slides[currentSlide].id], slideIdx: currentSlide});
                                                setIsEditingImage(true);
                                            }}
                                            className="h-full px-4 bg-[#f26522] text-white border border-transparent rounded-xl text-sm font-black flex justify-center items-center gap-2 hover:bg-[#d5581e] transition-colors shadow-sm whitespace-nowrap active:translate-y-0.5"
                                        >
                                            <SparklesIcon className="w-4 h-4" />
                                            <span>局部編輯</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                )}
            </section>
        </WrapperRight>
        </WrapperLayout>
      </main>

      {/* Final Action Section */}
      <section className="bg-white border border-zinc-200 shadow-sm rounded-3xl p-8 flex flex-col items-center justify-center gap-6 mt-8 max-w-4xl mx-auto w-full">
          <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">🎉 企劃與內容已準備就緒！</h2>
              <p className="text-zinc-500 text-sm">點擊下方按鈕，即可一次過匯出相片並複製內文。</p>
          </div>
          
          <button 
            disabled={isExporting}
            onClick={() => setShowExportPreview(true)} 
            className="w-full sm:w-auto px-10 py-5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-2xl text-xl font-bold whitespace-nowrap transition-all flex justify-center items-center gap-3 shadow-lg hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          >
             {isExporting ? <Loader2 className="animate-spin w-6 h-6" /> : "📸"} {isExporting ? '匯出中...' : '預覽與匯出至 Instagram'}
          </button>
          <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">Powered by Traveltopia Creator</p>
      </section>

      <div className="md:hidden mt-4">
        <button disabled={isExporting} onClick={() => setShowExportPreview(true)} className="w-full px-5 py-3.5 bg-gray-400 text-white hover:bg-gray-500 rounded-xl border border-transparent text-sm font-bold whitespace-nowrap transition-colors flex justify-center items-center shadow-sm active:translate-y-0.5 disabled:opacity-50 disabled:active:translate-y-0 gap-2">
           {isExporting ? <Loader2 className="animate-spin w-4 h-4" /> : "📸"} {isExporting ? '匯出中...' : '預覽全部'}
        </button>
      </div>

      <AnimatePresence>
        {copyStatus && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2D2D2A] text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-sm z-[70] flex items-center gap-2 border border-white/10 whitespace-nowrap">
                {copyStatus}
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enlargedImage && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => {
                   if(isEditingImage) return;
                   setEnlargedImage(null);
                }}
                className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8 flex-col gap-4", !isEditingImage && "cursor-zoom-out")}
            >
                <div 
                    className="relative max-w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl flex-shrink-0" 
                    onClick={(e) => e.stopPropagation()}
                    style={{ containerType: 'inline-size', height: isEditingImage ? 'calc(100% - 80px)' : '100%' }}
                >
                    <img 
                        src={enlargedImage.url} 
                        className="absolute inset-0 w-full h-full object-cover" 
                        onLoad={(e) => initCanvas(e.currentTarget)}
                        crossOrigin="anonymous"
                    />

                    <canvas 
                        ref={canvasRef}
                        className={cn("absolute inset-0 w-full h-full pointer-events-none touch-none", isEditingImage && "pointer-events-auto cursor-crosshair")}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        style={{ opacity: isEditingImage ? 1 : 0 }}
                    />
                    
                    {!isEditingImage && enlargedImage.slideIdx !== undefined && postData.slides[enlargedImage.slideIdx] && (
                        <>
                            <div className="absolute top-4 right-4 z-[70] pointer-events-auto">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (enlargedImage.slideIdx === undefined) return;
                                        const slideIdx = enlargedImage.slideIdx;
                                        const s = postData.slides[slideIdx];
                                        const slideId = s.id;
                                        setLoadingDesignSuggestion(prev => ({...prev, [slideId]: true}));
                                        try {
                                            const suggestion = await generateDesignSuggestion(images[slideId], s.imageText, s.imageBody);
                                            const ns = [...postData.slides];
                                            const currentDs = (ns[slideIdx] as any).designSettings || postData.designSettings || defaultData.designSettings;
                                            (ns[slideIdx] as any).designSettings = {
                                                ...currentDs,
                                                titleFontFamily: suggestion.titleFontFamily || currentDs.titleFontFamily || currentDs.fontFamily,
                                                titleTextEffect: suggestion.titleTextEffect || currentDs.titleTextEffect || currentDs.textEffect || 'shadow',
                                                titleSize: suggestion.titleSize || currentDs.titleSize,
                                                titleColor: suggestion.titleColor || currentDs.titleColor,
                                                bodyFontFamily: suggestion.bodyFontFamily || currentDs.bodyFontFamily || currentDs.fontFamily,
                                                bodyTextEffect: suggestion.bodyTextEffect || currentDs.bodyTextEffect || currentDs.textEffect || 'shadow',
                                                bodySize: suggestion.bodySize || currentDs.bodySize,
                                                bodyColor: suggestion.bodyColor || currentDs.bodyColor,
                                                layoutStyle: suggestion.layoutStyle || currentDs.layoutStyle,
                                                layoutOpacity: suggestion.layoutOpacity ?? currentDs.layoutOpacity,
                                            };
                                            setPostData({...postData, slides: ns});
                                            saveProjectData({...postData, slides: ns}, true);
                                        } catch (err) {
                                            console.error(err);
                                        }
                                        setLoadingDesignSuggestion(prev => ({...prev, [slideId]: false}));
                                    }}
                                    disabled={loadingDesignSuggestion[postData.slides[enlargedImage.slideIdx].id]}
                                    className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[12px] font-black px-4 py-2.5 rounded-full flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
                                >
                                    {loadingDesignSuggestion[postData.slides[enlargedImage.slideIdx].id] ? <Loader2 className="animate-spin w-4 h-4 text-[#f26522]" /> : <SparklesIcon className="w-4 h-4 text-[#f26522]" />}
                                    ✨ AI 智能排版與配色建議
                                </button>
                            </div>
                            <div className="absolute inset-0 pointer-events-none">
                                <div 
                                    className={cn("absolute left-0 right-0 pointer-events-none", getOuterLayoutBgClass(postData.slides[enlargedImage.slideIdx].textPosition as any, enlargedImage.slideIdx))}
                                    style={getLayoutPaddingStyle(postData.slides[enlargedImage.slideIdx].textPosition as any, enlargedImage.slideIdx)}
                                >
                                    <div className={cn("flex flex-col relative z-50 pointer-events-auto", getInnerLayoutBgClass(enlargedImage.slideIdx))} style={{ gap: '2.22cqw' }}>
                                        <TextareaAutosize 
                                            value={postData.slides[enlargedImage.slideIdx].imageText || ''}
                                            onChange={(e) => {
                                                if (enlargedImage.slideIdx === undefined) return;
                                                const ns = [...postData.slides];
                                                ns[enlargedImage.slideIdx].imageText = e.target.value;
                                                setPostData({...postData, slides: ns});
                                            }}
                                            onBlur={() => saveProjectData({...postData}, true)}
                                            placeholder="標題..."
                                            className="w-full font-black leading-tight drop-shadow-md outline-none bg-transparent resize-none overflow-hidden border-0 p-0 m-0 cursor-text focus:ring-0 focus:outline-none whitespace-pre-wrap"
                                            style={getTextStyle(true, enlargedImage.slideIdx)}
                                        />
                                        <TextareaAutosize 
                                            value={postData.slides[enlargedImage.slideIdx].imageBody || ''}
                                            onChange={(e) => {
                                                if (enlargedImage.slideIdx === undefined) return;
                                                const ns = [...postData.slides];
                                                ns[enlargedImage.slideIdx].imageBody = e.target.value;
                                                setPostData({...postData, slides: ns});
                                            }}
                                            onBlur={() => saveProjectData({...postData}, true)}
                                            placeholder="內容..."
                                            className="w-full font-semibold leading-relaxed drop-shadow-sm outline-none bg-transparent resize-none overflow-hidden border-0 p-0 m-0 cursor-text focus:ring-0 focus:outline-none placeholder:text-white/30"
                                            style={getTextStyle(false, enlargedImage.slideIdx)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!isEditingImage ? (
                    <Button 
                        variant="default" 
                        className="absolute bottom-6 right-6 lg:bottom-10 lg:right-10 rounded-full shadow-lg"
                        size="lg"
                        onClick={(e) => { e.stopPropagation(); setIsEditingImage(true); }}
                    >
                        🖌️ Edit Image
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 w-full max-w-lg shrink-0" onClick={e => e.stopPropagation()}>
                        <Input 
                            value={editPrompt}
                            onChange={e => setEditPrompt(e.target.value)}
                            placeholder="Circle an area and tell me what to change..."
                            className="bg-white/10 text-white border-white/20"
                            onKeyDown={e => {
                                if(e.key === 'Enter') handleEditImageSubmit();
                            }}
                        />
                        <Button 
                            onClick={handleEditImageSubmit} 
                            disabled={editImageLoading || !editPrompt}
                        >
                            {editImageLoading ? 'Editing...' : 'Submit'}
                        </Button>
                        <Button 
                            variant="outline" 
                            className="bg-transparent text-white border-white/20 hover:bg-white/10"
                            onClick={() => {
                                setIsEditingImage(false);
                                if(ctxRef.current && canvasRef.current) {
                                    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                                }
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="max-w-4xl p-6 max-h-[85vh] flex flex-col sm:max-w-3xl">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#2D3142]">
              <ImageIcon className="w-5 h-5 text-[#2EB1AD]" /> 圖庫與參考圖管理
          </DialogTitle>
          <DialogDescription>上傳您的角色或版面設計參考。大於 1MB 圖片會被自動壓縮上傳。</DialogDescription>
          
          <div className="flex gap-3 my-4">
               <label className="flex items-center gap-2 px-5 py-3 bg-[#FFF3E0] text-[#f26522] rounded-xl text-sm font-black cursor-pointer hover:bg-[#FFE0B2] transition shadow-sm active:translate-y-0.5 border border-transparent">
                   <Upload className="w-4 h-4" /> 
                   <span>上傳角色圖案</span>
                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadToLibrary(e, 'TT')} />
               </label>
               <label className="flex items-center gap-2 px-5 py-3 bg-[#E0F2F1] text-[#2EB1AD] rounded-xl text-sm font-black cursor-pointer hover:bg-[#B2DFDB] transition shadow-sm active:translate-y-0.5 border border-transparent">
                   <Upload className="w-4 h-4" /> 
                   <span>上傳版面參考</span>
                   <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadToLibrary(e, 'Layout')} />
               </label>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-2 pr-1 custom-scrollbar">
               {brandLibrary.length === 0 && (
                   <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-400">
                       <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                       <p className="font-bold">圖庫目前為空</p>
                   </div>
               )}
               {brandLibrary.map(item => (
                   <div key={item.id} className="relative group rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 shadow-sm">
                        <img 
                            src={item.dataUrl} 
                            className="w-full aspect-square object-cover cursor-zoom-in hover:scale-[1.03] transition-transform duration-300" 
                            onClick={() => setEnlargedImage({url: item.dataUrl})} 
                        />
                        <span className={cn("absolute top-2 left-2 text-[10px] uppercase font-black text-white px-2.5 py-1 rounded-full shadow-sm", item.category === 'TT' ? 'bg-[#f26522]' : 'bg-[#2EB1AD]')}>
                           {item.category === 'TT' ? '角色' : '版面'}
                        </span>
                        <button 
                             onClick={(e) => handleDeleteLibrary(item.id, e)}
                             className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <TrashIcon className="w-3 h-3" />
                        </button>
                   </div>
               ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
        <DialogContent className="max-w-5xl xl:max-w-7xl 2xl:max-w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-50 border-zinc-200">
            <div className="p-6 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
                <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#2D3142]">
                        📸 預覽與匯出
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                        檢查即將匯出的圖片與內文，確認無誤後即可一鍵匯出。
                    </DialogDescription>
                </div>
                {!exportFiles.length ? (
                    <button 
                      disabled={isExporting}
                      onClick={() => {
                          exportToIG().then((files) => {
                               if (files && files.length > 0) {
                                   setExportFiles(files);
                               }
                          });
                      }} 
                      className="px-8 py-3 bg-[#f26522] text-white hover:bg-[#e05a1d] rounded-xl text-base font-bold whitespace-nowrap transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {isExporting ? <Loader2 className="animate-spin w-5 h-5" /> : "📸"} {isExporting ? '準備相片...' : '準備匯出至 Instagram'}
                    </button>
                ) : (
                    <div className="flex gap-2">
                        {navigator.share && navigator.canShare && navigator.canShare({ files: exportFiles }) && (
                            <button 
                              disabled={isSharing}
                              onClick={async () => {
                                  if (isSharing) return;
                                  setIsSharing(true);
                                  try {
                                      await navigator.share({ files: exportFiles });
                                      showCopyStatus('✅ 已打開分享選單，內文已可隨時貼上！');
                                  } catch (err) {
                                      if ((err as Error).name !== 'AbortError') {
                                           console.error('Share failed', err);
                                      }
                                  } finally {
                                      setIsSharing(false);
                                  }
                              }} 
                              className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-base font-bold whitespace-nowrap transition-all flex justify-center items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                               {isSharing ? '分享中...' : '分享至應用程式'}
                            </button>
                        )}
                        <button 
                          onClick={async () => {
                              for (let i = 0; i < exportFiles.length; i++) {
                                  const file = exportFiles[i];
                                  const a = document.createElement('a');
                                  const url = URL.createObjectURL(file);
                                  a.href = url;
                                  a.download = file.name;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  if (i < exportFiles.length - 1) await new Promise(r => setTimeout(r, 500));
                              }
                              showCopyStatus(`✅ 已嘗試下載相片！若被瀏覽器阻擋，請使用單張下載。`);
                          }} 
                          className="px-6 py-3 bg-zinc-800 text-white hover:bg-zinc-700 rounded-xl text-base font-bold whitespace-nowrap transition-all flex justify-center items-center shadow-sm text-sm"
                        >
                           下載相片 (若失敗請使用單張下載)
                        </button>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col xl:flex-row gap-6">
                <div className="xl:w-2/3 flex flex-col gap-4">
                    <h3 className="font-bold text-zinc-800 px-2 flex items-center justify-between">
                       <span>🖼️ 圖片預覽 ({postData.slides.length + (postData.includeCta !== false ? 1 : 0)} 張)</span>
                       <span className="text-xs text-zinc-500 font-normal xl:hidden">左右滑動查看</span>
                    </h3>
                    <div className="flex xl:grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 overflow-x-auto xl:overflow-x-visible pb-4 snap-x xl:snap-none px-2">
                        {postData.slides.map((slide, idx) => (
                            <div key={`preview-${slide.id}`} className="min-w-[320px] sm:min-w-[400px] xl:min-w-0 xl:w-full aspect-[4/5] bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden relative snap-center xl:snap-align-none shrink-0 group" style={{ containerType: 'inline-size' }}>
                                {images[slide.id] ? (
                                    <>
                                        <img src={images[slide.id]} className="absolute inset-0 w-full h-full object-cover" />
                                        <div 
                                            className={cn("absolute left-0 right-0 pointer-events-none", getOuterLayoutBgClass(slide.textPosition as any, idx))}
                                            style={getLayoutPaddingStyle(slide.textPosition as any, idx)}
                                        >
                                            <div className={cn("flex flex-col cursor-pointer pointer-events-auto", getInnerLayoutBgClass(idx))} style={{ gap: '2.22cqw' }}>
                                                {slide.imageText && <h4 className="font-black leading-tight drop-shadow-md whitespace-pre-wrap" style={getTextStyle(true, idx)}>{slide.imageText}</h4>}
                                                {slide.imageBody && <p className="font-semibold leading-relaxed whitespace-pre-wrap drop-shadow-sm" style={getTextStyle(false, idx)}>{slide.imageBody}</p>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                                        <ImageIcon className="w-10 h-10 opacity-50" />
                                        <span className="text-sm font-medium">尚未生成圖片</span>
                                    </div>
                                )}
                                <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">
                                    {idx + 1}
                                </div>
                                {exportFiles[idx] && (
                                    <button
                                        onClick={() => {
                                            const a = document.createElement('a');
                                            const url = URL.createObjectURL(exportFiles[idx]);
                                            a.href = url;
                                            a.download = exportFiles[idx].name;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                            showCopyStatus(`✅ 第 ${idx + 1} 張相片已下載！`);
                                        }}
                                        className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white p-2 rounded backdrop-blur-sm transition-colors pointer-events-auto"
                                        title="下載此相片 (JPG)"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {postData.includeCta !== false && (
                            <div className="min-w-[320px] sm:min-w-[400px] xl:min-w-0 xl:w-full aspect-[4/5] bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden relative snap-center xl:snap-align-none shrink-0 group" style={{ containerType: 'inline-size' }}>
                                <CtaSlideContent selectedCtaUrl={selectedCtaUrl} />
                                <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm z-30">
                                    {postData.slides.length + 1} (CTA)
                                </div>
                                {exportFiles[postData.slides.length] && (
                                    <button
                                        onClick={() => {
                                            const a = document.createElement('a');
                                            const url = URL.createObjectURL(exportFiles[postData.slides.length]);
                                            a.href = url;
                                            a.download = exportFiles[postData.slides.length].name;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                            showCopyStatus(`✅ 結尾行動呼籲頁面已下載！`);
                                        }}
                                        className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white p-2 rounded backdrop-blur-sm transition-colors pointer-events-auto z-30"
                                        title="下載此相片 (JPG)"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="xl:w-1/3 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2 xl:px-0">
                       <h3 className="font-bold text-zinc-800">📝 貼文內文</h3>
                       <button onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(postData.mainCaption);
                            showCopyStatus('✅ 已複製內文！');
                          } catch (e) {}
                       }} className="text-[#2EB1AD] text-xs font-bold hover:underline flex items-center gap-1">
                           <CopyIcon className="w-3 h-3" /> 複製
                       </button>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 h-[400px] overflow-y-auto">
                        {postData.mainCaption || '尚無內文'}
                    </div>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, pointerEvents: 'none', visibility: 'visible' }}>
        {postData.includeCta !== false && (
            <div 
                id="export-slide-cta"
                className="bg-white overflow-hidden relative"
                style={{ 
                    width: 1080, 
                    height: 1350,
                    containerType: 'inline-size'
                }}
            >
                <CtaSlideContent selectedCtaUrl={selectedCtaUrl} />
            </div>
        )}
        {postData.slides.map((slide, idx) => (
            <div 
                key={`export-${slide.id}`}
                id={`export-slide-${idx}`}
                className="bg-white overflow-hidden relative"
                style={{ 
                    width: 1080, 
                    height: 1350,
                    containerType: 'inline-size'
                }}
            >
                {images[slide.id] ? (
                    <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${images[slide.id]})` }} />
                ) : (
                    <div className="absolute inset-0 bg-[#F7F6F3]" />
                )}

                <div 
                    className={cn("absolute left-0 right-0", getOuterLayoutBgClass(slide.textPosition as any, idx))}
                    style={getLayoutPaddingStyle(slide.textPosition as any, idx)}
                >
                    <div className={cn("flex flex-col", getInnerLayoutBgClass(idx))} style={{ gap: '2.22cqw' }}>
                        {slide.imageText && <h4 className="font-black leading-tight drop-shadow-md whitespace-pre-wrap" style={getTextStyle(true, idx)}>{slide.imageText}</h4>}
                        {slide.imageBody && <p className="font-semibold leading-relaxed whitespace-pre-wrap drop-shadow-sm" style={getTextStyle(false, idx)}>{slide.imageBody}</p>}
                    </div>
                </div>
            </div>
        ))}
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-[#2D3142] flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-[#f26522]" /> Settings / 設定
            </h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-600">Gemini API Key</label>
              <input 
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full h-12 px-4 rounded-xl border border-[#E5E7EB] bg-[#F7F6F3] focus:ring-2 focus:ring-[#f26522]/50 outline-none text-sm font-mono shadow-inner"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your API Key is saved locally on this device only. Get one for free from Google AI Studio.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (apiKeyInput.trim()) {
                    localStorage.setItem('gemini_api_key', apiKeyInput.trim());
                  } else {
                    localStorage.removeItem('gemini_api_key');
                  }
                  setShowSettings(false);
                  showCopyStatus('✅ API Key 儲存成功！');
                }}
                className="px-6 py-2.5 rounded-xl font-bold bg-[#f26522] text-white hover:bg-[#d8561a] transition-all shadow-md active:scale-95"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
