import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add icons
content = content.replace(
  `import { CopyIcon, SparklesIcon, TrashIcon, Image as ImageIcon, Loader2, RefreshCw, Upload, Download, ArrowRight, ShareIcon, ChevronLeft, ChevronRight, Check, LogOutIcon, Settings as SettingsIcon } from 'lucide-react';`,
  `import { CopyIcon, SparklesIcon, TrashIcon, Image as ImageIcon, Loader2, RefreshCw, Upload, Download, ArrowRight, ShareIcon, ChevronLeft, ChevronRight, Check, LogOutIcon, Settings as SettingsIcon, MousePointer2, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';`
);

// 2. Add CtaSlideContent
const ctaComponent = `
const CtaSlideContent = () => (
    <div className="w-full h-full bg-white relative flex flex-col justify-between overflow-hidden container" style={{ containerType: 'inline-size' }}>
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

`;
content = content.replace('export default function App() {', ctaComponent + 'export default function App() {');

// 3. Add default data includeCta
content = content.replace(
  `    layoutStyle: 'gradient', // 'gradient', 'solid', 'glass', 'textOnly'
    layoutOpacity: 100
  },
  mainCaption: "請在上方輸入主題並選擇所需頁數（1-6頁），系統會為你準備專業詳盡的 IG 圖文企劃！\\n\\n#TraveltopiaHK #英國生活",`,
  `    layoutStyle: 'gradient', // 'gradient', 'solid', 'glass', 'textOnly'
    layoutOpacity: 100
  },
  includeCta: true,
  mainCaption: "請在上方輸入主題並選擇所需頁數（1-6頁），系統會為你準備專業詳盡的 IG 圖文企劃！\\n\\n#TraveltopiaHK #英國生活",`
);

// 4. Update the hidden export div
content = content.replace(
  `            {/* Export Hidden Layer */}
            <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none opacity-0">
                {postData.slides.map((slide, idx) => (`,
  `            {/* Export Hidden Layer */}
            <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none opacity-0">
                {postData.includeCta !== false && (
                    <div id="export-slide-cta" className="relative w-[1080px] h-[1350px] bg-white">
                        <CtaSlideContent />
                    </div>
                )}
                {postData.slides.map((slide, idx) => (`
);

// 5. Update export function
content = content.replace(
  `                        files.push(file);
                    } catch (e) {
                        console.error('Slide export failed', e);
                    }
                }
            }
        }
        
        showCopyStatus(\`✅ 成功準備 \${files.length} 張圖片！\`);`,
  `                        files.push(file);
                    } catch (e) {
                        console.error('Slide export failed', e);
                    }
                }
            }
        }
        
        if (postData.includeCta !== false) {
            const el = document.getElementById('export-slide-cta');
            if (el) {
                try {
                    await htmlToImage.toJpeg(el, { quality: 0.1, canvasWidth: 1080, canvasHeight: 1350, skipFonts: true });
                    const dataUrl = await htmlToImage.toJpeg(el, { 
                        quality: 0.95, 
                        canvasWidth: 1080, 
                        canvasHeight: 1350,
                        pixelRatio: 1,
                        skipFonts: true,
                        cacheBust: true
                    });
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], \`traveltopia_slide_cta.jpg\`, { type: 'image/jpeg' });
                    files.push(file);
                } catch (e) {
                    console.error('CTA export failed', e);
                }
            }
        }

        showCopyStatus(\`✅ 成功準備 \${files.length} 張圖片！\`);`
);

// 6. Global Checkbox
content = content.replace(
  `                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Box 6: Content Editor & Pagination */}`,
  `                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[#E5E7EB] flex items-center gap-3">
                    <input 
                        type="checkbox" 
                        id="includeCta"
                        className="w-5 h-5 rounded border-gray-300 text-[#F26522] focus:ring-[#F26522] cursor-pointer"
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
                    <label htmlFor="includeCta" className="text-sm font-bold text-neutral-700 cursor-pointer">
                        加入結尾行動呼籲頁面 (Include CTA Page)
                    </label>
                </div>
            </div>

            {/* Box 6: Content Editor & Pagination */}`
);

// 7. Pagination Tab
content = content.replace(
  `                               {images[s.id] && <Check className="w-4 h-4 ml-1.5 inline text-white" />}
                           </button>
                        ))}
                    </div>`,
  `                               {images[s.id] && <Check className="w-4 h-4 ml-1.5 inline text-white" />}
                           </button>
                        ))}
                        {postData.includeCta !== false && (
                            <button 
                                onClick={() => setCurrentSlide(postData.slides.length)}
                                className={cn("px-4 py-2 border rounded-xl text-sm transition-all whitespace-nowrap font-black",
                                  currentSlide === postData.slides.length ? "bg-[#2EB1AD] text-white border-[#2EB1AD] shadow-sm scale-105" : "bg-[#F7F6F3] border-[#EAE8E4] text-neutral-500 hover:border-[#2EB1AD] hover:text-[#2EB1AD]"
                                )}
                            >
                                結尾 CTA 頁
                            </button>
                        )}
                    </div>`
);

// 8. Allow render if CTA selected
content = content.replace(
  `                {postData.slides[currentSlide] && (
                    <div className="flex flex-col lg:flex-row gap-6">`,
  `                {(postData.slides[currentSlide] || currentSlide === postData.slides.length) && (
                    <div className="flex flex-col lg:flex-row gap-6">`
);

// 9. Render Preview CTA
content = content.replace(
  `                                        <div 
                                            className="bg-white overflow-hidden relative w-full h-full"
                                        >
                                            {images[postData.slides[currentSlide].id] ? (`,
  `                                        <div 
                                            className="bg-white overflow-hidden relative w-full h-full"
                                        >
                                            {currentSlide === postData.slides.length ? (
                                                <CtaSlideContent />
                                            ) : images[postData.slides[currentSlide].id] ? (`
);

// 10. Render Empty Editor State for CTA
content = content.replace(
  `                        {/* Slide Content Editor */}
                        <div className="flex-1 bg-[#F7F6F3] border border-dashed border-[#E5E7EB] rounded-3xl p-6 flex flex-col gap-5">`,
  `                        {/* Slide Content Editor */}
                        {currentSlide === postData.slides.length ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-[#F7F6F3] border border-dashed border-[#E5E7EB] rounded-3xl p-6 text-center">
                                <h3 className="text-xl font-bold text-gray-700 mb-4">📢 結尾行動呼籲頁面 (CTA)</h3>
                                <p className="text-gray-500 text-sm max-w-sm mb-4">
                                    此頁面為固定設計，將會自動附加於您的貼文最後一頁。<br/>
                                    您可以透過左側全域設定中的核取方塊來取消隱藏。
                                </p>
                            </div>
                        ) : (
                        <div className="flex-1 bg-[#F7F6F3] border border-dashed border-[#E5E7EB] rounded-3xl p-6 flex flex-col gap-5">`
);

// 11. Close the ternary exactly where the editor column closes
content = content.replace(
  `                                            <SparklesIcon className="w-4 h-4" />
                                            <span>局部編輯</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>`,
  `                                            <SparklesIcon className="w-4 h-4" />
                                            <span>局部編輯</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                )}
            </section>`
);

fs.writeFileSync('src/App.tsx', content);

