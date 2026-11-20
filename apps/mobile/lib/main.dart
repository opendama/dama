import 'package:dama_mobile/app.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/supabase/supabase_init.dart';
import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  // Warm list-skip prefs so refresh restores the navigated page (web URL skip parity).
  await SkipStore.warm();
  runApp(const DamaApp());
}
