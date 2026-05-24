import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                )}
            </section>`;

const replacement = `                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
