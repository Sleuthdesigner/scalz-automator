<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Settings {
    public static function init(): void {
        add_action( 'admin_menu',            [ __CLASS__, 'register_menu' ] );
        add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_admin_assets' ] );
        add_action( 'admin_post_scalz_save_settings',  [ __CLASS__, 'handle_save' ] );
        add_action( 'admin_post_scalz_rotate_api_key', [ __CLASS__, 'handle_rotate_key' ] );
        add_action( 'admin_post_scalz_test_ai',        [ __CLASS__, 'handle_test_ai' ] );
    }
    public static function register_menu(): void {
        $wl = self::get_white_label();
        add_menu_page( $wl['plugin_name'], $wl['plugin_name'], 'manage_options', 'scalz-seo-automator', [ __CLASS__, 'render_settings_page' ], $wl['menu_icon'], 80 );
    }
    public static function enqueue_admin_assets( string $hook ): void {
        if ( strpos( $hook, 'scalz-seo-automator' ) === false ) return;
        wp_enqueue_style( 'scalz-admin', SCALZ_SEO_URL . 'admin/admin.css', [], SCALZ_SEO_VERSION );
    }
    public static function render_settings_page(): void { include SCALZ_SEO_DIR . 'admin/settings-page.php'; }
    public static function handle_save(): void {
        check_admin_referer( 'scalz_save_settings' ); if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
        $tab = sanitize_key( $_POST['scalz_active_tab'] ?? 'general' );
        if ( $tab === 'general' ) { update_option( 'scalz_seo_ai_provider', sanitize_text_field( $_POST['ai_provider'] ?? 'openai' ) ); update_option( 'scalz_seo_openai_api_key', sanitize_text_field( $_POST['openai_api_key'] ?? '' ) ); update_option( 'scalz_seo_openai_model', sanitize_text_field( $_POST['openai_model'] ?? 'gpt-4o' ) ); update_option( 'scalz_seo_ai_temperature', (string) floatval( $_POST['ai_temperature'] ?? 0.7 ) ); }
        if ( $tab === 'whitelabel' ) { update_option( 'scalz_seo_white_label', [ 'agency_name' => sanitize_text_field( $_POST['wl_agency_name'] ?? '' ), 'agency_url' => esc_url_raw( $_POST['wl_agency_url'] ?? '' ), 'plugin_name' => sanitize_text_field( $_POST['wl_plugin_name'] ?? 'SEO Automator' ), 'menu_icon' => sanitize_text_field( $_POST['wl_menu_icon'] ?? 'dashicons-chart-area' ), 'hide_branding' => ! empty( $_POST['wl_hide_branding'] ) ] ); }
        if ( $tab === 'prompts' ) { foreach ( [ 'scalz_seo_prompt_page_title', 'scalz_seo_prompt_meta_description', 'scalz_seo_prompt_acf_content', 'scalz_seo_prompt_blog_title', 'scalz_seo_prompt_blog_content', 'scalz_seo_prompt_alt_tag', 'scalz_seo_prompt_faq' ] as $f ) { if ( isset( $_POST[$f] ) ) update_option( $f, sanitize_textarea_field( $_POST[$f] ) ); } }
        wp_safe_redirect( admin_url( 'admin.php?page=scalz-seo-automator&tab=' . $tab . '&updated=1' ) ); exit;
    }
    public static function handle_rotate_key(): void { check_admin_referer( 'scalz_rotate_key' ); if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' ); update_option( 'scalz_seo_api_key', wp_generate_password( 32, false ) ); wp_safe_redirect( admin_url( 'admin.php?page=scalz-seo-automator&rotated=1' ) ); exit; }
    public static function handle_test_ai(): void {
        check_admin_referer( 'scalz_test_ai' ); if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
        $r = Scalz_Integration_Manager::test_connection(); wp_safe_redirect( admin_url( 'admin.php?page=scalz-seo-automator&ai_test=' . ( $r['success'] ? 'success' : 'error' ) . '&ai_msg=' . urlencode( $r['message'] ) ) ); exit;
    }
    public static function get_white_label(): array { return wp_parse_args( get_option( 'scalz_seo_white_label', [] ), [ 'agency_name' => '', 'agency_url' => '', 'plugin_name' => 'SEO Automator', 'menu_icon' => 'dashicons-chart-area', 'hide_branding' => false ] ); }
    public static function get_all_settings(): array { return [ 'api_key' => get_option( 'scalz_seo_api_key', '' ), 'ai_provider' => get_option( 'scalz_seo_ai_provider', 'openai' ), 'openai_model' => get_option( 'scalz_seo_openai_model', 'gpt-4o' ), 'temperature' => get_option( 'scalz_seo_ai_temperature', '0.7' ), 'white_label' => self::get_white_label() ]; }
    public static function update_settings( array $data ): void { foreach ( [ 'ai_provider' => 'scalz_seo_ai_provider', 'openai_api_key' => 'scalz_seo_openai_api_key', 'openai_model' => 'scalz_seo_openai_model', 'temperature' => 'scalz_seo_ai_temperature' ] as $k => $opt ) { if ( isset( $data[$k] ) ) update_option( $opt, sanitize_text_field( $data[$k] ) ); } }
}
