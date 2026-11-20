/// Chrome from GET /public/home-chrome (fail closed).
class HomeSurfaceChrome {
  const HomeSurfaceChrome({
    required this.liveSectionTitle,
    required this.liveSectionBlurb,
    required this.playersLabel,
    required this.prizeLabel,
    required this.entryLabel,
    required this.freeLabel,
    required this.enrollCta,
    required this.joinCta,
    required this.topUpCta,
    required this.emptyLive,
    required this.emptyValue,
    required this.homeChromeUnavailable,
    required this.carouselAria,
    required this.prizePoolNowLabel,
    required this.prizePoolIfFullLabel,
    required this.prizePoolGuaranteedLabel,
    required this.prizePoolFrozenBlurb,
    required this.prizePoolEntryFeesNote,
    required this.metaSeparator,
    required this.amountCurrencySeparator,
  });

  final String liveSectionTitle;
  final String liveSectionBlurb;
  final String playersLabel;
  final String prizeLabel;
  final String entryLabel;
  final String freeLabel;
  final String enrollCta;
  final String joinCta;
  final String topUpCta;
  final String emptyLive;
  final String emptyValue;
  final String homeChromeUnavailable;
  final String carouselAria;
  final String prizePoolNowLabel;
  final String prizePoolIfFullLabel;
  final String prizePoolGuaranteedLabel;
  final String prizePoolFrozenBlurb;
  final String prizePoolEntryFeesNote;
  final String metaSeparator;
  final String amountCurrencySeparator;

  bool get isReady =>
      liveSectionTitle.isNotEmpty &&
      liveSectionBlurb.isNotEmpty &&
      playersLabel.isNotEmpty &&
      prizeLabel.isNotEmpty &&
      entryLabel.isNotEmpty &&
      freeLabel.isNotEmpty &&
      enrollCta.isNotEmpty &&
      joinCta.isNotEmpty &&
      topUpCta.isNotEmpty &&
      emptyLive.isNotEmpty &&
      emptyValue.isNotEmpty &&
      homeChromeUnavailable.isNotEmpty &&
      carouselAria.isNotEmpty &&
      prizePoolNowLabel.isNotEmpty &&
      prizePoolIfFullLabel.isNotEmpty &&
      prizePoolGuaranteedLabel.isNotEmpty &&
      prizePoolFrozenBlurb.isNotEmpty &&
      prizePoolEntryFeesNote.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty;

  /// Returns null when any required field is missing (fail closed).
  static HomeSurfaceChrome? fromJson(Map<String, dynamic> json) {
    String raw(String k) => (json[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    final chrome = HomeSurfaceChrome(
      liveSectionTitle: s('live_section_title'),
      liveSectionBlurb: s('live_section_blurb'),
      playersLabel: s('players_label'),
      prizeLabel: s('prize_label'),
      entryLabel: s('entry_label'),
      freeLabel: s('free_label'),
      enrollCta: s('enroll_cta'),
      joinCta: s('join_cta'),
      topUpCta: s('top_up_cta'),
      emptyLive: s('empty_live'),
      emptyValue: s('empty_value'),
      homeChromeUnavailable: s('home_chrome_unavailable'),
      carouselAria: s('carousel_aria'),
      prizePoolNowLabel: s('prize_pool_now_label'),
      prizePoolIfFullLabel: s('prize_pool_if_full_label'),
      prizePoolGuaranteedLabel: s('prize_pool_guaranteed_label'),
      prizePoolFrozenBlurb: s('prize_pool_frozen_blurb'),
      prizePoolEntryFeesNote: s('prize_pool_entry_fees_note'),
      metaSeparator: raw('meta_separator'),
      amountCurrencySeparator: raw('amount_currency_separator'),
    );
    return chrome.isReady ? chrome : null;
  }
}
